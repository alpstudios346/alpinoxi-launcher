import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { dirs } from './paths'
import { download, getJson } from './http'
import type { JavaRuntime } from '@shared/types'

const execFileAsync = promisify(execFile)

/** Reports the java major version required by a given Minecraft version. */
export function requiredJavaMajor(mcVersion: string): number {
  const [major, minor] = mcVersion.split('.').map((n) => parseInt(n, 10))
  if (mcVersion.startsWith('1.')) {
    const real = minor
    if (Number.isNaN(real)) return 8
    if (real <= 16) return 8
    if (real === 17) return 16
    if (real <= 19) return 17
    if (real <= 20) return 17
    return 21
  }
  // 26.x style future versioning
  if (!Number.isNaN(major) && major >= 26) return 21
  return 8
}

async function probeJava(path: string, source: 'system' | 'managed'): Promise<JavaRuntime | null> {
  try {
    const { stderr, stdout } = await execFileAsync(path, ['-version'], { windowsHide: true })
    const out = `${stderr}${stdout}`
    const match = out.match(/version "([^"]+)"/)
    if (!match) return null
    const version = match[1]
    const major = version.startsWith('1.') ? parseInt(version.split('.')[1], 10) : parseInt(version.split('.')[0], 10)
    const vendorMatch = out.match(/^(OpenJDK|Java\(TM\)|Eclipse Adoptium|Microsoft|Azul|GraalVM|Amazon)/im)
    return { path, version, major, vendor: vendorMatch?.[1], source }
  } catch {
    return null
  }
}

function javaExeIn(dir: string): string | null {
  const candidates = [join(dir, 'bin', 'javaw.exe'), join(dir, 'bin', 'java.exe'), join(dir, 'jre', 'bin', 'javaw.exe')]
  return candidates.find((c) => existsSync(c)) ?? null
}

async function scanDir(base: string, out: JavaRuntime[], seen: Set<string>): Promise<void> {
  if (!base || !existsSync(base)) return
  let entries: string[] = []
  try {
    entries = readdirSync(base)
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(base, entry)
    const exe = javaExeIn(full)
    if (exe && !seen.has(exe)) {
      const info = await probeJava(exe, 'system')
      if (info) {
        seen.add(exe)
        out.push(info)
      }
    }
  }
}

/** Discovers every usable java runtime: managed ones first, then the system. */
export async function listJava(): Promise<JavaRuntime[]> {
  const out: JavaRuntime[] = []
  const seen = new Set<string>()

  // managed runtimes (downloaded by us)
  if (existsSync(dirs.java)) {
    for (const entry of readdirSync(dirs.java)) {
      const exe = javaExeIn(join(dirs.java, entry))
      if (exe && !seen.has(exe)) {
        const info = await probeJava(exe, 'managed')
        if (info) {
          seen.add(exe)
          out.push(info)
        }
      }
    }
  }

  // PATH
  const which = process.platform === 'win32' ? 'where' : 'which'
  try {
    const { stdout } = await execFileAsync(which, ['java'], { windowsHide: true })
    const first = stdout.split(/\r?\n/).find(Boolean)
    if (first && !seen.has(first)) {
      const info = await probeJava(first, 'system')
      if (info) {
        seen.add(first)
        out.push(info)
      }
    }
  } catch {
    /* java not on PATH */
  }

  const bases = [
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Zulu',
    'C:\\Program Files\\Amazon Corretto',
    'C:\\Program Files\\BellSoft',
    'C:\\Program Files\\GraalVM',
    `${process.env.LOCALAPPDATA}\\Programs\\Eclipse Adoptium`,
    '/usr/lib/jvm',
    '/Library/Java/JavaVirtualMachines'
  ]
  for (const base of bases) await scanDir(base, out, seen)

  return out.sort((a, b) => b.major - a.major)
}

/** Returns the best matching java for a Minecraft version, downloading one if needed. */
export async function resolveJava(mcVersion: string): Promise<JavaRuntime | null> {
  const need = requiredJavaMajor(mcVersion)
  const runtimes = await listJava()
  const exact = runtimes.find((r) => r.major === need)
  if (exact) return exact
  const newer = runtimes.filter((r) => r.major >= need).sort((a, b) => a.major - b.major)[0]
  if (newer) return newer
  try {
    return await downloadJava(need)
  } catch {
    return runtimes[0] ?? null
  }
}

interface AdoptiumPackage {
  binary: { package: { link: string; name: string } }
  release_name: string
}

/** Downloads and unpacks a Temurin JRE for the requested major version. */
export async function downloadJava(major: number): Promise<JavaRuntime> {
  const target = join(dirs.java, `temurin-${major}`)
  const existing = javaExeIn(target)
  if (existing) {
    const info = await probeJava(existing, 'managed')
    if (info) return info
  }

  const arch = process.arch === 'arm64' ? 'aarch64' : 'x64'
  const os = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux'
  const api = `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?architecture=${arch}&image_type=jre&os=${os}&vendor=eclipse`
  const assets = await getJson<AdoptiumPackage[]>(api)
  const pkg = assets[0]?.binary.package
  if (!pkg) throw new Error(`No Temurin JRE ${major} available for ${os}/${arch}`)

  const archive = join(dirs.cache, pkg.name)
  await download(pkg.link, archive)

  mkdirSync(target, { recursive: true })
  if (pkg.name.endsWith('.zip')) {
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(archive)
    zip.extractAllTo(dirs.cache, true)
    // adoptium zips contain a top-level folder
    const extracted = readdirSync(dirs.cache).find((d) => d.startsWith('jdk-') || d.startsWith('jre-') || d.includes(`-${major}`))
    if (extracted) {
      const exe = javaExeIn(join(dirs.cache, extracted))
      if (exe) {
        rmSync(target, { recursive: true, force: true })
        const { renameSync } = await import('node:fs')
        renameSync(join(dirs.cache, extracted), target)
      }
    }
  } else {
    const { execFileSync } = await import('node:child_process')
    execFileSync('tar', ['-xzf', archive, '-C', target, '--strip-components=1'], { windowsHide: true })
  }

  const exe = javaExeIn(target)
  const info = exe ? await probeJava(exe, 'managed') : null
  if (!info) throw new Error(`Failed to install Java ${major}`)
  return info
}
