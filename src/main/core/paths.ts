import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

/**
 * Central place where every on-disk location is derived from.
 * The root can be overridden by the user through `settings.dataDir`.
 */
let root = join(app.getPath('appData'), 'AlpinoxiClient')

export function setDataRoot(dir: string): void {
  root = dir
  ensureDirs()
}

export function dataRoot(): string {
  return root
}

export const dirs = {
  get root(): string {
    return root
  },
  get settings(): string {
    return join(root, 'settings')
  },
  get versions(): string {
    return join(root, 'versions')
  },
  get libraries(): string {
    return join(root, 'libraries')
  },
  get assets(): string {
    return join(root, 'assets')
  },
  get instances(): string {
    return join(root, 'instances')
  },
  get java(): string {
    return join(root, 'java')
  },
  get cache(): string {
    return join(root, 'cache')
  },
  get cosmetics(): string {
    return join(root, 'cosmetics')
  },
  get logs(): string {
    return join(root, 'logs')
  },
  get skins(): string {
    return join(root, 'skins')
  }
}

export function ensureDirs(): void {
  for (const p of [root, dirs.versions, dirs.libraries, dirs.assets, dirs.instances, dirs.java, dirs.cache, dirs.cosmetics, dirs.logs, dirs.skins, dirs.settings]) {
    if (!existsSync(p)) mkdirSync(p, { recursive: true })
  }
}

export function instanceDir(id: string): string {
  return join(dirs.instances, id)
}

export function instanceGameDir(id: string): string {
  return join(instanceDir(id), 'minecraft')
}

export function instanceModsDir(id: string): string {
  return join(instanceGameDir(id), 'mods')
}
