import { join } from 'node:path'
import type { AppSettings } from '@shared/types'
import { dirs } from './paths'
import { JsonStore } from './store'

export const OFFICIAL_MS_CLIENT_ID = '00000000402b5328'

export const defaultSettings = (): AppSettings => ({
  dataDir: dirs.root,
  language: 'tr',
  theme: 'midnight',
  accentColor: '#7C5CFF',
  reduceMotion: false,
  closeToTray: true,
  discordRpc: true,
  showSnapshots: false,
  javaMemoryDefaultMb: 4096,
  autoUpdate: true,
  socialServerUrl: 'ws://localhost:8787',
  microsoftClientId: OFFICIAL_MS_CLIENT_ID,
  youtubeClientId: '',
  youtubeClientSecret: ''
})

let store: JsonStore<AppSettings> | null = null

export function settingsStore(): JsonStore<AppSettings> {
  if (!store) store = new JsonStore<AppSettings>(join(dirs.settings, 'settings.json'), defaultSettings())
  return store
}

export function getSettings(): AppSettings {
  return settingsStore().get()
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  return settingsStore().set(patch)
}
