/**
 * Shared types used by the main process, the preload bridge and the renderer.
 * This file is the single source of truth for the IPC contract.
 */

export type LoaderType =
  | 'vanilla'
  | 'fabric'
  | 'quilt'
  | 'forge'
  | 'neoforge'
  | 'optifine'
  | 'alpinoxi'

export type AccountType = 'offline' | 'microsoft' | 'elyby'

export type MinecraftVersionType = 'release' | 'snapshot' | 'old_beta' | 'old_alpha'

/** A Minecraft version as published in the Mojang version manifest. */
export interface MinecraftVersion {
  id: string
  type: MinecraftVersionType
  releaseTime: string
  url: string
}

/** A selectable loader build for a given Minecraft version. */
export interface LoaderBuild {
  loader: LoaderType
  version: string
  mcVersion: string
  stable: boolean
}

export interface Account {
  id: string
  type: AccountType
  username: string
  uuid: string
  accessToken?: string
  refreshToken?: string
  /** ms oauth only */
  expiresAt?: number
  skinUrl?: string
  capeUrl?: string
  createdAt: number
}

/** Optional metadata describing the client modpack attached to an instance. */
export interface ModpackRef {
  source: 'alpinoxi' | 'modrinth' | 'local'
  projectId?: string
  versionId?: string
  name: string
  /** bundled alpinoxi client feature flags that were applied */
  features?: string[]
}

export interface Instance {
  id: string
  name: string
  mcVersion: string
  loader: LoaderType
  loaderVersion?: string
  accountId?: string
  /** true => "client" mode (Alpinoxi Client modpack applied), false => vanilla/clean */
  clientEnabled: boolean
  modpack?: ModpackRef
  javaPath?: string
  memoryMinMb: number
  memoryMaxMb: number
  jvmArgs: string[]
  gameArgs: string[]
  icon?: string
  createdAt: number
  lastPlayedAt?: number
  playtimeMs?: number
}

export interface ModrinthSearchHit {
  projectId: string
  slug: string
  title: string
  description: string
  author: string
  downloads: number
  follows: number
  iconUrl?: string
  gallery?: string[]
  categories: string[]
  versions: string[]
  loaders: string[]
  projectType: 'mod' | 'modpack' | 'resourcepack' | 'shader' | 'datapack' | 'plugin'
}

export interface ModrinthVersionFile {
  url: string
  filename: string
  size: number
  primary: boolean
}

export interface ModrinthVersion {
  id: string
  projectId: string
  name: string
  versionNumber: string
  gameVersions: string[]
  loaders: string[]
  files: ModrinthVersionFile[]
  dependencies: { projectId?: string; versionId?: string; dependencyType: string }[]
}

export type ProgressPhase =
  | 'prepare'
  | 'version'
  | 'libraries'
  | 'assets'
  | 'natives'
  | 'loader'
  | 'java'
  | 'mods'
  | 'launch'
  | 'done'
  | 'error'

export interface ProgressEvent {
  phase: ProgressPhase
  message: string
  current?: number
  total?: number
  percent?: number
}

export interface GameLogEvent {
  instanceId: string
  stream: 'stdout' | 'stderr' | 'launcher'
  line: string
  at: number
}

/** Installed java runtime discovered on the system. */
export interface JavaRuntime {
  path: string
  version: string
  major: number
  vendor?: string
  source: 'system' | 'managed'
}

export interface HudConfig {
  enabled: boolean
  fps: boolean
  coordinates: boolean
  biome: boolean
  ping: boolean
  memory: boolean
  keyStrokes: boolean
  cps: boolean
  armor: boolean
  potionEffects: boolean
  session: boolean
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  scale: number
  accentColor: string
}

export interface CosmeticItem {
  id: string
  name: string
  category: 'cape' | 'wings' | 'hat' | 'bandana' | 'boots' | 'back' | 'emote'
  textureUrl: string
  animated: boolean
  freeInMicrosoft: boolean
  requiredForElyby: boolean
}

export interface EquippedCosmetics {
  [category: string]: string | undefined
}

export interface Friend {
  id: string
  username: string
  status: 'online' | 'offline' | 'playing' | 'away'
  activity?: string
  skinUrl?: string
}

export interface PartyMember {
  id: string
  username: string
  isHost: boolean
  ready: boolean
  skinUrl?: string
}

export interface Party {
  id: string
  code: string
  hostId: string
  members: PartyMember[]
  createdAt: number
}

export interface AppSettings {
  dataDir: string
  language: 'tr' | 'en'
  theme: 'midnight' | 'aurora' | 'ember'
  accentColor: string
  reduceMotion: boolean
  closeToTray: boolean
  discordRpc: boolean
  showSnapshots: boolean
  javaMemoryDefaultMb: number
  autoUpdate: boolean
  socialServerUrl: string
  microsoftClientId?: string
  youtubeClientId?: string
  youtubeClientSecret?: string
}

export interface AppInfo {
  version: string
  platform: string
  arch: string
  dataDir: string
  versionsDir: string
  instancesDir: string
}

export interface YoutubeChannel {
  id: string
  title: string
  description: string
  thumbnailUrl?: string
  subscriberCount: number
  videoCount: number
  viewCount: number
}

export interface YoutubeVideoUpload {
  filePath: string
  title: string
  description: string
  tags: string[]
  privacyStatus: 'private' | 'unlisted' | 'public'
  categoryId?: string
}

export interface ElysbyCosmeticSession {
  /** cookie/session captured from the ely.by browser-like window */
  signedIn: boolean
  username?: string
}
