import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import type { Account } from '@shared/types'
import { dirs } from '../paths'
import { ListStore, JsonStore } from '../store'
import { getSettings, OFFICIAL_MS_CLIENT_ID } from '../settings'
import { getJson, postForm, postJson } from '../http'

const MS_AUTHORITY = 'https://login.microsoftonline.com/consumers/oauth2/v2.0'
const XBL_AUTH = 'https://user.auth.xboxlive.com/user/authenticate'
const XSTS_AUTH = 'https://xsts.auth.xboxlive.com/xsts/authorize'
const MC_LOGIN = 'https://api.minecraftservices.com/authentication/login_with_xbox'
const MC_PROFILE = 'https://api.minecraftservices.com/minecraft/profile'
const MS_SCOPE = 'XboxLive.signin offline_access'

/**
 * "mc launcher orji": Kullanıcı kendi Azure uygulamasını girmemişse resmî
 * Minecraft Launcher istemci kimliği (herkese açık) kullanılır.
 */
function resolvedClientId(): string {
  return getSettings().microsoftClientId || process.env.ALPINOXI_MS_CLIENT_ID || OFFICIAL_MS_CLIENT_ID
}

let accountStore: ListStore<Account> | null = null
let currentStore: JsonStore<{ id: string | null }> | null = null

function accounts(): ListStore<Account> {
  if (!accountStore) accountStore = new ListStore<Account>(join(dirs.settings, 'accounts.json'))
  return accountStore
}

function currentIds(): JsonStore<{ id: string | null }> {
  if (!currentStore) currentStore = new JsonStore<{ id: string | null }>(join(dirs.settings, 'current-account.json'), { id: null })
  return currentStore
}

export function listAccounts(): Account[] {
  return accounts().all()
}

export function removeAccount(id: string): Account[] {
  const next = accounts().remove((a) => a.id === id)
  if (currentIds().get().id === id) currentIds().set({ id: next[0]?.id ?? null })
  return next
}

export function setCurrentAccount(id: string): void {
  currentIds().set({ id })
}

export function currentAccount(): Account | null {
  const id = currentIds().get().id
  const list = accounts().all()
  return list.find((a) => a.id === id) ?? list[0] ?? null
}

function upsertAccount(account: Account): Account {
  const existing = accounts().all()
  const match = existing.find((a) => a.uuid === account.uuid && a.type === account.type)
  if (match) {
    accounts().update((a) => a.id === match.id, account)
    currentIds().set({ id: match.id })
    return { ...account, id: match.id }
  }
  accounts().add(account)
  currentIds().set({ id: account.id })
  return account
}

/** Java-compatible offline UUID (UUID.nameUUIDFromBytes("OfflinePlayer:<name>")). */
export function offlineUuid(username: string): string {
  const hash = createHash('md5').update(`OfflinePlayer:${username}`, 'utf8').digest()
  hash[6] = (hash[6] & 0x0f) | 0x30
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function createOfflineAccount(username: string): Account {
  const account: Account = {
    id: randomUUID(),
    type: 'offline',
    username,
    uuid: offlineUuid(username),
    createdAt: Date.now()
  }
  return upsertAccount(account)
}

function withDashes(raw: string): string {
  if (raw.includes('-')) return raw
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
}

interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  interval: number
  expires_in: number
  message: string
}

export async function microsoftStart(): Promise<DeviceCodeResponse> {
  return postForm<DeviceCodeResponse>(`${MS_AUTHORITY}/devicecode`, {
    client_id: resolvedClientId(),
    scope: MS_SCOPE
  })
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  error?: string
}

export async function microsoftPoll(deviceCode: string): Promise<Account | null> {
  const clientId = resolvedClientId()
  const res = await fetch(`${MS_AUTHORITY}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: clientId,
      device_code: deviceCode
    }).toString()
  })
  const data = (await res.json()) as TokenResponse
  if (!res.ok) {
    if (data.error === 'authorization_pending' || data.error === 'slow_down') return null
    throw new Error(data.error ?? 'Microsoft girişi başarısız')
  }
  return completeMicrosoftLogin(data)
}

async function completeMicrosoftLogin(token: TokenResponse): Promise<Account> {
  const xbl = await postJson<{ Token: string; DisplayClaims: { xui: { uhs: string }[] } }>(XBL_AUTH, {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${token.access_token}` },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT'
  })

  const xsts = await postJson<{ Token: string; DisplayClaims: { xui: { uhs: string }[] } }>(XSTS_AUTH, {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.Token] },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT'
  })

  const uhs = xsts.DisplayClaims.xui[0].uhs
  const mc = await postJson<{ access_token: string; expires_in: number }>(MC_LOGIN, {
    identityToken: `XBL3.0 x=${uhs};${xsts.Token}`
  })

  const profile = await getJson<{
    id: string
    name: string
    skins?: { url: string; state: string }[]
    capes?: { url: string }[]
  }>(MC_PROFILE, { Authorization: `Bearer ${mc.access_token}` })

  const account: Account = {
    id: randomUUID(),
    type: 'microsoft',
    username: profile.name,
    uuid: withDashes(profile.id),
    accessToken: mc.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + mc.expires_in * 1000,
    skinUrl: profile.skins?.find((s) => s.state === 'ACTIVE')?.url ?? profile.skins?.[0]?.url,
    capeUrl: profile.capes?.[0]?.url,
    createdAt: Date.now()
  }
  return upsertAccount(account)
}

/** Silent refresh using a stored refresh token. */
export async function microsoftRefresh(): Promise<Account | null> {
  const account = currentAccount()
  if (!account || account.type !== 'microsoft' || !account.refreshToken) return account
  const clientId = resolvedClientId()
  try {
    const data = await postForm<TokenResponse>(`${MS_AUTHORITY}/token`, {
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
      scope: MS_SCOPE
    })
    const merged = { ...data, refresh_token: data.refresh_token ?? account.refreshToken }
    return completeMicrosoftLogin(merged)
  } catch {
    return account
  }
}

// ---------------------------------------------------------------------------
// ely.by — browser-like login window + session capture
// ---------------------------------------------------------------------------

const ELYBY_LOGIN = 'https://account.ely.by/login'
const ELYBY_INFO = 'https://account.ely.by/api/account/v1/info'
const ELYBY_SKIN = 'https://account.ely.by/api/mojang/textures'

let elyWindow: BrowserWindow | null = null

/**
 * Opens a real ely.by login window (no iframe). The user signs in with their
 * own credentials; we then read the session to build an account.
 */
export async function elybyStart(parent?: BrowserWindow): Promise<void> {
  if (elyWindow && !elyWindow.isDestroyed()) {
    elyWindow.focus()
    return
  }
  elyWindow = new BrowserWindow({
    width: 520,
    height: 720,
    parent,
    title: 'ely.by ile giriş yap',
    autoHideMenuBar: true,
    webPreferences: {
      partition: 'persist:elyby',
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  await elyWindow.loadURL(ELYBY_LOGIN)
}

export async function elybySession(): Promise<{ signedIn: boolean; username?: string }> {
  try {
    const cookieHeader = await collectElybyCookies()
    if (!cookieHeader) return { signedIn: false }
    const info = await fetchElybyInfo(cookieHeader)
    return { signedIn: !!info, username: info?.username }
  } catch {
    return { signedIn: false }
  }
}

async function collectElybyCookies(): Promise<string> {
  if (!elyWindow || elyWindow.isDestroyed()) return ''
  const session = elyWindow.webContents.session
  const cookies = await session.cookies.get({ domain: 'ely.by' })
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
}

async function fetchElybyInfo(
  cookieHeader: string
): Promise<{ username: string; uuid: string; skinUrl?: string; capeUrl?: string } | null> {
  try {
    const res = await fetch(ELYBY_INFO, {
      headers: { Cookie: cookieHeader, 'User-Agent': 'AlpinoxiLauncher/1.0', Accept: 'application/json' }
    })
    if (!res.ok) return null
    const data = (await res.json()) as { username: string; uuid: string }
    if (!data?.username) return null
    return {
      username: data.username,
      uuid: withDashes(data.uuid),
      skinUrl: ELYBY_SKIN
    }
  } catch {
    return null
  }
}

export async function elybyComplete(): Promise<Account | null> {
  const cookieHeader = await collectElybyCookies()
  if (!cookieHeader) throw new Error('ely.by oturumu bulunamadı')
  const info = await fetchElybyInfo(cookieHeader)
  if (!info) throw new Error('ely.by hesap bilgileri alınamadı')

  const account: Account = {
    id: randomUUID(),
    type: 'elyby',
    username: info.username,
    uuid: info.uuid,
    accessToken: cookieHeader,
    skinUrl: info.skinUrl,
    capeUrl: info.capeUrl,
    createdAt: Date.now()
  }
  const saved = upsertAccount(account)
  if (elyWindow && !elyWindow.isDestroyed()) elyWindow.close()
  elyWindow = null
  return saved
}

export function closeElybyWindow(): void {
  if (elyWindow && !elyWindow.isDestroyed()) elyWindow.close()
  elyWindow = null
}

/** ely.by account/skin page, embedded as a real browser view (never an iframe). */
export function elybyCosmeticsWindow(parent: BrowserWindow): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    parent,
    title: 'ely.by Kozmetikler',
    autoHideMenuBar: true,
    webPreferences: {
      partition: 'persist:elyby',
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  void win.loadURL('https://ely.by/cosmetics')
  return win
}
