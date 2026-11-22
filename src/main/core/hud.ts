import { join } from 'node:path'
import type { HudConfig } from '@shared/types'
import { dirs } from './paths'
import { JsonStore } from './store'

const defaults: HudConfig = {
  enabled: true,
  fps: true,
  coordinates: true,
  biome: true,
  ping: true,
  memory: true,
  keyStrokes: true,
  cps: true,
  armor: false,
  potionEffects: true,
  session: true,
  position: 'top-left',
  scale: 1,
  accentColor: '#7C5CFF'
}

let store: JsonStore<HudConfig> | null = null

function hud(): JsonStore<HudConfig> {
  if (!store) store = new JsonStore<HudConfig>(join(dirs.settings, 'hud.json'), defaults)
  return store
}

export function getHud(): HudConfig {
  return hud().get()
}

export function setHud(patch: Partial<HudConfig>): HudConfig {
  return hud().set(patch)
}
