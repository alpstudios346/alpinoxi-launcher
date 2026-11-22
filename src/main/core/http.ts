import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export interface DownloadOptions {
  sha1?: string
  size?: number
  retries?: number
  headers?: Record<string, string>
  /** skip the request entirely if the file already exists with a matching sha1 */
  verifyExisting?: boolean
}

const USER_AGENT = 'AlpinoxiLauncher/1.0 (+https://github.com/alpstudios346/alpinoxi-launcher)'

export async function getJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...headers } })
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export async function postJson<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export async function postForm<T>(url: string, form: Record<string, string>, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers
    },
    body: new URLSearchParams(form).toString()
  })
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

function sha1File(file: string): string {
  const hash = createHash('sha1')
  hash.update(readFileSync(file))
  return hash.digest('hex')
}

export async function download(url: string, dest: string, opts: DownloadOptions = {}): Promise<void> {
  const retries = opts.retries ?? 3
  if (!existsSync(dirname(dest))) mkdirSync(dirname(dest), { recursive: true })

  if (opts.verifyExisting && opts.sha1 && existsSync(dest)) {
    try {
      if (sha1File(dest) === opts.sha1) return
    } catch {
      /* fallthrough to re-download */
    }
  }

  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const tmp = `${dest}.part`
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...opts.headers } })
      if (!res.ok || !res.body) throw new Error(`GET ${url} -> ${res.status}`)
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp))
      if (opts.sha1) {
        const got = sha1File(tmp)
        if (got !== opts.sha1) {
          unlinkSync(tmp)
          throw new Error(`sha1 mismatch for ${url} (expected ${opts.sha1}, got ${got})`)
        }
      }
      renameSync(tmp, dest)
      return
    } catch (err) {
      lastError = err
      try {
        if (existsSync(tmp)) unlinkSync(tmp)
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to download ${url}`)
}

export interface DownloadItem {
  url: string
  dest: string
  sha1?: string
}

/**
 * Downloads many files with bounded concurrency, reporting progress as it goes.
 * Already-valid files (matching sha1) are skipped, which is what keeps repeat
 * launches fast.
 */
export async function downloadMany(
  items: DownloadItem[],
  concurrency = 8,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const total = items.length
  let done = 0
  let index = 0

  const worker = async (): Promise<void> => {
    while (index < total) {
      const current = items[index++]
      try {
        await download(current.url, current.dest, { sha1: current.sha1, verifyExisting: true, retries: 2 })
      } catch (err) {
        // keep a missing/invalid asset from aborting the whole batch
        if (current.sha1) {
          try {
            await download(current.url, current.dest, { sha1: current.sha1, retries: 1 })
          } catch {
            /* give up on this file */
          }
        } else {
          void err
        }
      }
      done++
      onProgress?.(done, total)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(total, 1)) }, worker))
}

export function fileSize(file: string): number {
  try {
    return statSync(file).size
  } catch {
    return 0
  }
}
