import { randomUUID } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { Instance, LoaderType } from '@shared/types'
import { dirs, instanceDir, instanceGameDir, instanceModsDir } from './paths'
import { ListStore } from './store'
import { getSettings } from './settings'

let store: ListStore<Instance> | null = null

function instances(): ListStore<Instance> {
  if (!store) store = new ListStore<Instance>(join(dirs.instances, 'instances.json'))
  return store
}

export function listInstances(): Instance[] {
  return instances().all()
}

export function getInstance(id: string): Instance | undefined {
  return instances().find((i) => i.id === id)
}

export function createInstance(
  input: Partial<Instance> & { name: string; mcVersion: string; loader: LoaderType }
): Instance {
  const settings = getSettings()
  const instance: Instance = {
    id: randomUUID(),
    name: input.name,
    mcVersion: input.mcVersion,
    loader: input.loader,
    loaderVersion: input.loaderVersion,
    accountId: input.accountId,
    clientEnabled: input.clientEnabled ?? false,
    modpack: input.modpack,
    javaPath: input.javaPath,
    memoryMinMb: input.memoryMinMb ?? 1024,
    memoryMaxMb: input.memoryMaxMb ?? settings.javaMemoryDefaultMb,
    jvmArgs: input.jvmArgs ?? [],
    gameArgs: input.gameArgs ?? [],
    icon: input.icon,
    createdAt: Date.now(),
    lastPlayedAt: input.lastPlayedAt,
    playtimeMs: input.playtimeMs ?? 0
  }
  ensureInstanceLayout(instance.id)
  instances().add(instance)
  return instance
}

export function updateInstance(id: string, patch: Partial<Instance>): Instance {
  const existing = getInstance(id)
  if (!existing) throw new Error(`Kurulum bulunamadı: ${id}`)
  instances().update((i) => i.id === id, patch)
  return getInstance(id)!
}

export function removeInstance(id: string): void {
  instances().remove((i) => i.id === id)
  const dir = instanceDir(id)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}

export function duplicateInstance(id: string): Instance {
  const source = getInstance(id)
  if (!source) throw new Error(`Kurulum bulunamadı: ${id}`)
  const copy = createInstance({ ...source, name: `${source.name} (kopya)` })
  // copy the game folder over
  const srcMods = instanceModsDir(id)
  if (existsSync(srcMods)) {
    const destMods = instanceModsDir(copy.id)
    mkdirSync(destMods, { recursive: true })
    cpSync(srcMods, destMods, { recursive: true })
  }
  return copy
}

export function ensureInstanceLayout(id: string): void {
  for (const p of [instanceDir(id), instanceGameDir(id), instanceModsDir(id)]) {
    if (!existsSync(p)) mkdirSync(p, { recursive: true })
  }
}

export function listMods(id: string): string[] {
  const dir = instanceModsDir(id)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
}

export function removeMod(id: string, filename: string): void {
  const file = join(instanceModsDir(id), filename)
  if (existsSync(file)) rmSync(file, { force: true })
}

export function touchPlaytime(id: string, ms: number): void {
  const existing = getInstance(id)
  if (!existing) return
  instances().update((i) => i.id === id, {
    lastPlayedAt: Date.now(),
    playtimeMs: (existing.playtimeMs ?? 0) + ms
  })
}
