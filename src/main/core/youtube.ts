import { createServer, type Server } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { join } from 'node:path'
import { AddressInfo } from 'node:net'
import type { YoutubeChannel, YoutubeVideoUpload } from '@shared/types'
import { dirs } from './paths'
import { getSettings } from './settings'
import { JsonStore } from './store'
import { postForm, getJson } from './http'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/youtube/v3'
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube'
].join(' ')

interface YoutubeTokens {
  access_token?: string
  refresh_token?: string
  expires_at?: number
}

let tokenStore: JsonStore<YoutubeTokens> | null = null
let loopback: Server | null = null
let pendingRedirectUri = ''
let pendingCode: string | null = null
let cachedChannels: YoutubeChannel[] = []

function tokens(): JsonStore<YoutubeTokens> {
  if (!tokenStore) tokenStore = new JsonStore<YoutubeTokens>(join(dirs.settings, 'youtube.json'), {})
  return tokenStore
}

function credentials(): { clientId: string; clientSecret: string } {
  const s = getSettings()
  return { clientId: s.youtubeClientId ?? '', clientSecret: s.youtubeClientSecret ?? '' }
}

/** Starts a loopback OAuth flow; the renderer opens the returned URL in a browser. */
export async function youtubeAuthStart(): Promise<{ authUrl: string }> {
  const { clientId } = credentials()
  if (!clientId) throw new Error('YouTube istemci kimliği ayarlanmamış (Ayarlar > YouTube).')

  if (loopback) {
    loopback.close()
    loopback = null
  }
  pendingCode = null

  await new Promise<void>((resolve) => {
    loopback = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const code = url.searchParams.get('code')
      if (code) {
        pendingCode = code
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<h2>Alpinoxi Launcher</h2><p>Yetkilendirme tamamlandı, bu sekmeyi kapatabilirsiniz.</p>')
      } else {
        res.writeHead(400)
        res.end('code yok')
      }
      resolve()
    })
    loopback.listen(0, '127.0.0.1', () => {
      const port = (loopback!.address() as AddressInfo).port
      pendingRedirectUri = `http://127.0.0.1:${port}`
      resolve()
    })
  })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: pendingRedirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent'
  })
  return { authUrl: `${AUTH_URL}?${params.toString()}` }
}

export async function youtubeAuthComplete(): Promise<YoutubeChannel[]> {
  const { clientId, clientSecret } = credentials()
  if (!pendingCode) throw new Error('Yetkilendirme kodu alınamadı, önce giriş başlatın.')
  const data = await postForm<YoutubeTokens>(TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    code: pendingCode,
    grant_type: 'authorization_code',
    redirect_uri: pendingRedirectUri
  })
  tokens().replace({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data as unknown as { expires_in: number }).expires_in * 1000
  })
  pendingCode = null
  if (loopback) {
    loopback.close()
    loopback = null
  }
  return fetchChannels()
}

async function accessToken(): Promise<string> {
  const current = tokens().get()
  if (current.access_token && (current.expires_at ?? 0) > Date.now() + 30_000) return current.access_token
  const { clientId, clientSecret } = credentials()
  if (!current.refresh_token) throw new Error('YouTube oturumu yok')
  const data = await postForm<YoutubeTokens>(TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: current.refresh_token,
    grant_type: 'refresh_token'
  })
  tokens().set({ access_token: data.access_token, expires_at: Date.now() + (data as unknown as { expires_in: number }).expires_in * 1000 })
  return data.access_token!
}

export async function youtubeChannels(): Promise<YoutubeChannel[]> {
  if (cachedChannels.length) return cachedChannels
  return fetchChannels()
}

async function fetchChannels(): Promise<YoutubeChannel[]> {
  const token = await accessToken()
  const data = await getJson<{
    items: {
      id: string
      snippet: { title: string; description: string; thumbnails?: { default?: { url: string } } }
      statistics: { subscriberCount?: string; videoCount?: string; viewCount?: string }
    }[]
  }>(`${API}/channels?part=snippet,statistics&mine=true`, { Authorization: `Bearer ${token}` })
  cachedChannels = (data.items ?? []).map((c) => ({
    id: c.id,
    title: c.snippet.title,
    description: c.snippet.description,
    thumbnailUrl: c.snippet.thumbnails?.default?.url,
    subscriberCount: parseInt(c.statistics.subscriberCount ?? '0', 10),
    videoCount: parseInt(c.statistics.videoCount ?? '0', 10),
    viewCount: parseInt(c.statistics.viewCount ?? '0', 10)
  }))
  return cachedChannels
}

export async function youtubeUpload(
  input: YoutubeVideoUpload,
  onProgress: (percent: number) => void
): Promise<{ videoId: string }> {
  const token = await accessToken()
  const size = statSync(input.filePath).size
  const metadata = {
    snippet: {
      title: input.title,
      description: input.description,
      tags: input.tags,
      categoryId: input.categoryId ?? '20'
    },
    status: { privacyStatus: input.privacyStatus }
  }

  const initRes = await fetch(`${API}/videos?uploadType=resumable&part=snippet,status`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/*',
      'X-Upload-Content-Length': String(size)
    },
    body: JSON.stringify(metadata)
  })
  if (!initRes.ok) throw new Error(`YouTube yükleme başlatılamadı (${initRes.status})`)
  const uploadUrl = initRes.headers.get('location')
  if (!uploadUrl) throw new Error('YouTube upload url alınamadı')

  const uploadRes = await new Promise<{ videoId: string }>((resolve, reject) => {
    const stream = createReadStream(input.filePath)
    let sent = 0
    stream.on('data', (chunk) => {
      sent += chunk.length
      onProgress(Math.round((sent / size) * 100))
    })
    const put = fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/*',
        'Content-Length': String(size)
      },
      body: stream as unknown as RequestInit['body'],
      duplex: 'half'
    } as RequestInit)
    put
      .then(async (res) => {
        if (!res.ok) throw new Error(`YouTube yükleme başarısız (${res.status})`)
        const json = (await res.json()) as { id: string }
        resolve({ videoId: json.id })
      })
      .catch(reject)
  })
  return uploadRes
}
