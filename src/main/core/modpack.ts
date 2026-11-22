import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import AdmZip from 'adm-zip'
import type { Instance, LoaderType, ProgressEvent } from '@shared/types'
import { instanceGameDir, instanceModsDir } from './paths'
import { download, postJson } from './http'
import { createInstance, getInstance, updateInstance } from './install'
import { installClientPack } from './client-pack'
import { getVersionById, installVersion } from './modrinth'

const MODRINTH_API = 'https://api.modrinth.com/v2'
const UA = 'alpstudios346/alpinoxi-launcher/1.0.0'

interface MrpackFile {
  path: string
  hashes: { sha1: string; sha512: string }
  downloads: string[]
  fileSize: number
  env?: { client: string; server: string }
}

interface Mrpack {
  formatVersion: number
  game: 'minecraft'
  versionId: string
  name: string
  summary?: string
  files: MrpackFile[]
  dependencies: Record<string, string>
}

function hashOf(file: string): { sha1: string; sha512: string } {
  const data = readFileSync(file)
  return {
    sha1: createHash('sha1').update(data).digest('hex'),
    sha512: createHash('sha512').update(data).digest('hex')
  }
}

function loaderDependency(loader: LoaderType, loaderVersion?: string): Record<string, string> {
  if (!loaderVersion) return {}
  switch (loader) {
    case 'fabric':
    case 'alpinoxi':
      return { 'fabric-loader': loaderVersion }
    case 'quilt':
      return { 'quilt-loader': loaderVersion }
    case 'forge':
      return { forge: loaderVersion }
    case 'neoforge':
      return { neoforge: loaderVersion }
    default:
      return {}
  }
}

function loaderFromDependencies(deps: Record<string, string>): { loader: LoaderType; loaderVersion?: string } {
  if (deps['fabric-loader']) return { loader: 'fabric', loaderVersion: deps['fabric-loader'] }
  if (deps['quilt-loader']) return { loader: 'quilt', loaderVersion: deps['quilt-loader'] }
  if (deps.forge) return { loader: 'forge', loaderVersion: deps.forge }
  if (deps.neoforge) return { loader: 'neoforge', loaderVersion: deps.neoforge }
  return { loader: 'vanilla' }
}

/** Looks mod jars up on Modrinth by sha512 so exports stay small (no re-hosting). */
async function lookupByHash(hashes: string[]): Promise<Record<string, { id: string; files: { url: string; filename: string }[] }>> {
  if (hashes.length === 0) return {}
  try {
    return await postJson<Record<string, { id: string; files: { url: string; filename: string }[] }>>(
      `${MODRINTH_API}/version_files`,
      { hashes, algorithm: 'sha512' },
      { 'User-Agent': UA }
    )
  } catch {
    return {}
  }
}

export async function exportModpack(instanceId: string, outPath: string): Promise<string> {
  const instance = getInstance(instanceId)
  if (!instance) throw new Error('Kurulum bulunamadı')
  const modsDir = instanceModsDir(instanceId)
  const zip = new AdmZip()
  const files: MrpackFile[] = []

  const jars = existsSync(modsDir) ? readdirSync(modsDir).filter((f) => f.endsWith('.jar')) : []
  const hashes = jars.map((j) => hashOf(join(modsDir, j)).sha512)
  const lookup = await lookupByHash(hashes)

  for (const jar of jars) {
    const full = join(modsDir, jar)
    const { sha1, sha512 } = hashOf(full)
    const match = lookup[sha512]
    if (match && match.files?.[0]) {
      files.push({
        path: `mods/${jar}`,
        hashes: { sha1, sha512 },
        downloads: [match.files[0].url],
        fileSize: readFileSync(full).length,
        env: { client: 'required', server: 'required' }
      })
    } else {
      // bundle unknown jars as overrides so nothing is lost
      zip.addLocalFile(full, 'overrides/mods')
    }
  }

  const pack: Mrpack = {
    formatVersion: 1,
    game: 'minecraft',
    versionId: '1.0.0',
    name: instance.name,
    summary: `Alpinoxi Client tarafından oluşturuldu — ${instance.mcVersion} / ${instance.loader}`,
    files,
    dependencies: { minecraft: instance.mcVersion, ...loaderDependency(instance.loader, instance.loaderVersion) }
  }
  zip.addFile('modrinth.index.json', Buffer.from(JSON.stringify(pack, null, 2), 'utf8'))
  mkdirSync(join(outPath, '..'), { recursive: true })
  zip.writeZip(outPath)
  return outPath
}

export async function importModpack(
  mrpackPath: string,
  onProgress: (e: ProgressEvent) => void
): Promise<Instance> {
  const zip = new AdmZip(mrpackPath)
  const entry = zip.getEntry('modrinth.index.json')
  if (!entry) throw new Error('Geçersiz mod paketi: modrinth.index.json bulunamadı')
  const pack = JSON.parse(entry.getData().toString('utf8')) as Mrpack

  const { loader, loaderVersion } = loaderFromDependencies(pack.dependencies)
  const instance = createInstance({
    name: pack.name || basename(mrpackPath, '.mrpack'),
    mcVersion: pack.dependencies.minecraft,
    loader,
    loaderVersion,
    clientEnabled: pack.name.toLowerCase().includes('alpinoxi'),
    modpack: { source: 'modrinth', name: pack.name, versionId: pack.versionId }
  })

  const modsDir = instanceModsDir(instance.id)
  mkdirSync(modsDir, { recursive: true })

  let index = 0
  for (const file of pack.files) {
    index++
    onProgress({
      phase: 'mods',
      message: `${basename(file.path)} indiriliyor…`,
      current: index,
      total: pack.files.length,
      percent: Math.round((index / pack.files.length) * 100)
    })
    const dest = join(instanceGameDir(instance.id), file.path)
    try {
      await download(file.downloads[0], dest, { sha1: file.hashes.sha1, retries: 2 })
    } catch {
      /* continue with the rest */
    }
  }

  // apply overrides/
  for (const e of zip.getEntries()) {
    if (!e.entryName.startsWith('overrides/') || e.isDirectory) continue
    const dest = join(instanceGameDir(instance.id), e.entryName.replace(/^overrides\//, ''))
    mkdirSync(join(dest, '..'), { recursive: true })
    writeFileSync(dest, e.getData())
  }

  return instance
}

/** Creates a new instance that mirrors another one's mods, optionally + client pack. */
export async function createFromInstance(
  sourceId: string,
  name: string,
  includeClient: boolean,
  onProgress: (e: ProgressEvent) => void
): Promise<Instance> {
  const source = getInstance(sourceId)
  if (!source) throw new Error('Kaynak kurulum bulunamadı')
  const instance = createInstance({
    name,
    mcVersion: source.mcVersion,
    loader: source.loader,
    loaderVersion: source.loaderVersion,
    clientEnabled: includeClient,
    modpack: includeClient
      ? { source: 'alpinoxi', name: `${name} (Alpinoxi Client)`, features: [] }
      : undefined
  })

  const srcMods = instanceModsDir(sourceId)
  const destMods = instanceModsDir(instance.id)
  mkdirSync(destMods, { recursive: true })
  if (existsSync(srcMods)) {
    const { cpSync } = await import('node:fs')
    cpSync(srcMods, destMods, { recursive: true })
  }

  if (includeClient) {
    const result = await installClientPack(instance, onProgress)
    updateInstance(instance.id, {
      modpack: { source: 'alpinoxi', name: `${name} (Alpinoxi Client)`, features: result.installed }
    })
  }
  return getInstance(instance.id)!
}

/** Creates a brand new instance (client or no-client) from scratch. */
export async function createStandalone(
  input: {
    name: string
    mcVersion: string
    loader: LoaderType
    loaderVersion?: string
    includeClient: boolean
    modsFromInstance?: string
  },
  onProgress: (e: ProgressEvent) => void
): Promise<Instance> {
  const instance = createInstance({
    name: input.name,
    mcVersion: input.mcVersion,
    loader: input.loader,
    loaderVersion: input.loaderVersion,
    clientEnabled: input.includeClient,
    modpack: input.includeClient ? { source: 'alpinoxi', name: `${input.name} (Alpinoxi Client)`, features: [] } : undefined
  })

  if (input.modsFromInstance) {
    const srcMods = instanceModsDir(input.modsFromInstance)
    if (existsSync(srcMods)) {
      const destMods = instanceModsDir(instance.id)
      mkdirSync(destMods, { recursive: true })
      const { cpSync } = await import('node:fs')
      cpSync(srcMods, destMods, { recursive: true })
    }
  }

  if (input.includeClient) {
    const result = await installClientPack(instance, onProgress)
    updateInstance(instance.id, {
      modpack: { source: 'alpinoxi', name: `${input.name} (Alpinoxi Client)`, features: result.installed }
    })
  }
  return getInstance(instance.id)!
}

export async function installModpackVersion(
  instanceId: string,
  versionId: string,
  mcVersion: string,
  loader: string,
  onProgress: (e: ProgressEvent) => void
): Promise<void> {
  const version = await getVersionById(versionId)
  if (!version) throw new Error('Mod paketi sürümü bulunamadı')
  onProgress({ phase: 'mods', message: 'Mod paketi indiriliyor…' })
  await installVersion(instanceId, version)
  void mcVersion
  void loader
}
