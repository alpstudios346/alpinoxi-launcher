import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Friend, HudConfig, Party } from '@shared/types'
import type { SocialPayload } from '@shared/ipc'
import { instanceGameDir } from './paths'
import { getHud, setHud } from './hud'
import { getActiveSkin } from './cosmetics'
import { applySocialFromBridge, socialState } from './social'
import { currentAccount } from './auth'

/**
 * Launcher <-> oyun içi modül köprüsü.
 *
 * Tek bir JSON dosyası (`<oyun dizini>/config/alpinoxi-bridge.json`) hem launcher
 * hem de Fabric modülü tarafından okunur/yazılır. Böylece HUD ayarları ve
 * arkadaşlık/parti durumu iki taraf arasında iki yönlü senkronize kalır.
 * Ağ bağlantısının sahibi launcher'dır; mod yalnızca dosyayı düzenler.
 */

export interface ModHud {
  enabled: boolean
  scale: number
  layout: 'left' | 'right'
  accent: string
  elements: Record<string, boolean>
}

export interface ModFriend {
  id: string
  username: string
  status: string
}

export interface ModMember {
  id: string
  username: string
  isHost: boolean
  ready: boolean
}

export interface ModParty {
  id: string
  code: string
  hostId: string
  members: ModMember[]
}

export interface ModSocial {
  selfId: string
  selfName: string
  connected: boolean
  friends: ModFriend[]
  party: ModParty | null
}

export interface ModSkin {
  /** oyun dizinine göre ya da mutlak yol; boşsa yok */
  path: string
  /** 'classic' | 'slim' */
  model: string
  username: string
}

export interface BridgePayload {
  hud: ModHud
  social: ModSocial
  skin?: ModSkin
  source: 'launcher' | 'mod'
  updatedAt: number
}

type BridgeListener = (payload: { hud: HudConfig; social: SocialPayload; skin?: ModSkin }) => void

let activeInstanceId: string | null = null
let listener: BridgeListener | null = null

export function onBridgeUpdate(cb: BridgeListener): void {
  listener = cb
}

/** Oyun başlatıldığında/durduğunda köprü hedefini ayarlar. */
export function setBridgeInstance(instanceId: string | null): void {
  activeInstanceId = instanceId
}

export function activeBridgeInstance(): string | null {
  return activeInstanceId
}

export function bridgeFile(instanceId: string): string {
  return join(instanceGameDir(instanceId), 'config', 'alpinoxi-bridge.json')
}

// ---------------------------------------------------------------------------
// dönüşümler
// ---------------------------------------------------------------------------

function hudToMod(h: HudConfig): ModHud {
  return {
    enabled: h.enabled,
    scale: h.scale,
    layout: h.position.includes('right') ? 'right' : 'left',
    accent: h.accentColor,
    elements: {
      fps: h.fps,
      cps: h.cps,
      coords: h.coordinates,
      ping: h.ping,
      keystrokes: h.keyStrokes,
      memory: h.memory,
      time: h.session
    }
  }
}

function modToHud(m: ModHud, prev: HudConfig): HudConfig {
  const e = m?.elements ?? {}
  const pick = (key: string, fallback: boolean): boolean =>
    typeof e[key] === 'boolean' ? (e[key] as boolean) : fallback
  return {
    ...prev,
    enabled: typeof m?.enabled === 'boolean' ? m.enabled : prev.enabled,
    scale: typeof m?.scale === 'number' ? m.scale : prev.scale,
    accentColor: typeof m?.accent === 'string' ? m.accent : prev.accentColor,
    position: (m?.layout ?? '').toLowerCase() === 'right' ? 'top-right' : 'top-left',
    fps: pick('fps', prev.fps),
    cps: pick('cps', prev.cps),
    coordinates: pick('coords', prev.coordinates),
    ping: pick('ping', prev.ping),
    keyStrokes: pick('keystrokes', prev.keyStrokes),
    memory: pick('memory', prev.memory),
    session: pick('time', prev.session)
  }
}

function normalizeStatus(status: string): Friend['status'] {
  return status === 'online' || status === 'playing' || status === 'away' ? status : 'offline'
}

function socialToMod(): ModSocial {
  const state = socialState()
  const account = currentAccount()
  return {
    selfId: state.selfId ?? account?.uuid ?? '',
    selfName: account?.username ?? '',
    connected: state.connected,
    friends: state.friends.map((f) => ({ id: f.id, username: f.username, status: f.status })),
    party: state.party
      ? {
          id: state.party.id,
          code: state.party.code,
          hostId: state.party.hostId,
          members: state.party.members.map((m) => ({
            id: m.id,
            username: m.username,
            isHost: m.isHost,
            ready: m.ready
          }))
        }
      : null
  }
}

function socialFromMod(mod: ModSocial): void {
  const friends = (mod?.friends ?? []).map((f) => ({
    id: f.id,
    username: f.username,
    status: f.status
  }))
  const party: Party | null = mod?.party
    ? {
        id: mod.party.id,
        code: mod.party.code,
        hostId: mod.party.hostId,
        createdAt: Date.now(),
        members: (mod.party.members ?? []).map((m) => ({
          id: m.id,
          username: m.username,
          isHost: m.isHost,
          ready: m.ready
        }))
      }
    : null
  applySocialFromBridge(friends, party)
}

function resolveSkin(): ModSkin | undefined {
  const account = currentAccount()
  const active = getActiveSkin()
  if (!active) return undefined

  // Skin'i oyun dizinine kopyala; QuickSkin bulunmayan sürümlerde istemci (launcher)
  // bu dosyayı kullanır. 1.20.1'de QuickSkin varsa oyun içi değiştirme önceliklidir.
  let path = active.path
  const instanceId = activeInstanceId
  if (instanceId) {
    const configDir = join(instanceGameDir(instanceId), 'config')
    const dest = join(configDir, 'alpinoxi-skin.png')
    try {
      mkdirSync(configDir, { recursive: true })
      copyFileSync(active.path, dest)
      path = dest
    } catch {
      /* kopyalanamadı — kaynak yolu kullan */
    }
  }

  return { path: path.replace(/\\/g, '/'), model: active.model, username: account?.username ?? '' }
}

// ---------------------------------------------------------------------------
// okuma / yazma
// ---------------------------------------------------------------------------

export function readBridge(instanceId: string): BridgePayload | null {
  const file = bridgeFile(instanceId)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as BridgePayload
  } catch {
    return null
  }
}

export function writeBridge(instanceId: string, payload: BridgePayload): void {
  const file = bridgeFile(instanceId)
  try {
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8')
  } catch {
    /* yazılamadı — sessizce geç */
  }
}

/** Launcher durumunu (HUD + sosyal + skin) aktif oyun kurulumuna yazar. */
export function pushBridge(instanceId: string | null = activeInstanceId): void {
  if (!instanceId) return
  writeBridge(instanceId, {
    hud: hudToMod(getHud()),
    social: socialToMod(),
    skin: resolveSkin(),
    source: 'launcher',
    updatedAt: Date.now()
  })
}

/**
 * Mod tarafının yazdığı değişiklikleri launcher'a uygular.
 * Değişiklik varsa dinleyicilere bildirir ve otoriter durumu geri yazar.
 */
export function pullBridge(instanceId: string | null = activeInstanceId): boolean {
  if (!instanceId) return false
  const payload = readBridge(instanceId)
  if (!payload || payload.source !== 'mod') return false

  const prevHud = getHud()
  const nextHud = modToHud(payload.hud, prevHud)
  const hudChanged = JSON.stringify(prevHud) !== JSON.stringify(nextHud)
  if (hudChanged) setHud(nextHud)

  const before = JSON.stringify(socialState())
  socialFromMod(payload.social)
  const socialChanged = before !== JSON.stringify(socialState())

  // Otoriter durumu geri yaz (mod bir sonraki turda aynı değerleri görsün).
  pushBridge(instanceId)

  if (hudChanged || socialChanged) {
    listener?.({ hud: getHud(), social: socialState(), skin: payload.skin })
  }
  return hudChanged || socialChanged
}
