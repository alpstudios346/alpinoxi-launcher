import { existsSync, mkdirSync, readFileSync, readdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { release } from 'node:os'
import { join } from 'node:path'
import { dirs } from './paths'
import { download, downloadMany, getJson, type DownloadItem } from './http'

export const MOJANG_MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
export const RESOURCES_URL = 'https://resources.download.minecraft.net'
export const LIBRARIES_URL = 'https://libraries.minecraft.net'

export interface Rule {
  action: 'allow' | 'deny'
  os?: { name?: string; version?: string; arch?: string }
  features?: Record<string, boolean>
}

export interface Artifact {
  path: string
  sha1: string
  size: number
  url: string
}

export interface Library {
  name: string
  downloads?: { artifact?: Artifact; classifiers?: Record<string, Artifact> }
  natives?: Record<string, string>
  rules?: Rule[]
  extract?: { exclude: string[] }
  url?: string
}

export type ArgumentValue = string | { rules?: Rule[]; value: string | string[] }

export interface VersionJson {
  id: string
  inheritsFrom?: string
  type: string
  mainClass: string
  assets?: string
  assetIndex?: { id: string; sha1: string; size: number; totalSize: number; url: string }
  downloads?: { client?: Artifact; server?: Artifact }
  libraries: Library[]
  javaVersion?: { component: string; majorVersion: number }
  arguments?: { game: ArgumentValue[]; jvm: ArgumentValue[] }
  minecraftArguments?: string
  logging?: unknown
  complianceLevel?: number
}

export function osName(): string {
  return process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
}

function osArch(): string {
  return process.arch === 'x64' ? 'x86_64' : process.arch === 'arm64' ? 'aarch64' : 'x86'
}

function ruleMatches(rule: Rule, features: Record<string, boolean>): boolean {
  if (rule.os) {
    if (rule.os.name && rule.os.name !== osName()) return false
    if (rule.os.arch && rule.os.arch !== osArch()) return false
    if (rule.os.version && !new RegExp(rule.os.version).test(release())) return false
  }
  if (rule.features) {
    for (const [key, value] of Object.entries(rule.features)) {
      if ((features[key] ?? false) !== value) return false
    }
  }
  return true
}

/** Standard Mojang rule evaluation (deny-by-default once any rule exists). */
export function evaluateRules(rules: Rule[] | undefined, features: Record<string, boolean> = {}): boolean {
  if (!rules || rules.length === 0) return true
  let allowed = false
  for (const rule of rules) {
    if (ruleMatches(rule, features)) allowed = rule.action === 'allow'
  }
  return allowed
}

export function libraryRelPath(lib: Library): string {
  if (lib.downloads?.artifact?.path) return lib.downloads.artifact.path
  const [group, artifact, version, classifier] = lib.name.split(':')
  const g = group.replace(/\./g, '/')
  const file = classifier ? `${artifact}-${version}-${classifier}.jar` : `${artifact}-${version}.jar`
  return `${g}/${artifact}/${version}/${file}`
}

export function libraryFile(lib: Library): string {
  return join(dirs.libraries, libraryRelPath(lib))
}

/** Natives classifier key for the current OS (resolving ${arch}). */
export function nativesClassifier(lib: Library): string | undefined {
  if (!lib.natives) return undefined
  const raw = lib.natives[osName()]
  return raw ? raw.replace('${arch}', process.arch === 'x64' ? '64' : '32') : undefined
}

/** Libraries that apply to this OS + the current feature set. */
export function applicableLibraries(version: VersionJson, features: Record<string, boolean> = {}): Library[] {
  return version.libraries.filter((lib) => evaluateRules(lib.rules, features))
}

interface ManifestResponse {
  latest: { release: string; snapshot: string }
  versions: { id: string; type: string; releaseTime: string; url: string }[]
}

let manifestCache: ManifestResponse | null = null

export async function getManifest(force = false): Promise<ManifestResponse> {
  if (manifestCache && !force) return manifestCache
  manifestCache = await getJson<ManifestResponse>(MOJANG_MANIFEST)
  return manifestCache
}

const versionJsonCache = new Map<string, VersionJson>()

/** Returns the (cached on disk) version json for a vanilla version id. */
export async function getVersionJson(id: string, force = false): Promise<VersionJson> {
  if (versionJsonCache.has(id) && !force) return versionJsonCache.get(id)!
  const file = join(dirs.versions, id, `${id}.json`)
  if (existsSync(file) && !force) {
    const json = JSON.parse(readFileSync(file, 'utf8')) as VersionJson
    versionJsonCache.set(id, json)
    return json
  }
  const manifest = await getManifest()
  const entry = manifest.versions.find((v) => v.id === id)
  if (!entry) throw new Error(`Unknown Minecraft version: ${id}`)
  const json = await getJson<VersionJson>(entry.url)
  mkdirSync(join(dirs.versions, id), { recursive: true })
  writeFileSync(file, JSON.stringify(json), 'utf8')
  versionJsonCache.set(id, json)
  return json
}

export function clearVersionCache(id?: string): void {
  if (id) versionJsonCache.delete(id)
  else versionJsonCache.clear()
}

/** Loads a version json from disk (custom/loader ids) or from Mojang (vanilla). */
export async function loadVersionJson(id: string): Promise<VersionJson> {
  const file = join(dirs.versions, id, `${id}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as VersionJson
  return getVersionJson(id)
}

/** Downloads the client jar for a version. */
export async function downloadClient(version: VersionJson): Promise<string> {
  const artifact = version.downloads?.client
  const dest = join(dirs.versions, version.id, `${version.id}.jar`)
  const clientFromParent = !artifact
  if (clientFromParent) return dest
  await download(artifact!.url, dest, { sha1: artifact!.sha1, verifyExisting: true })
  return dest
}

/** Downloads every applicable library and returns the classpath entries. */
export async function downloadLibraries(
  version: VersionJson,
  features: Record<string, boolean>,
  onProgress?: (done: number, total: number) => void
): Promise<string[]> {
  const libs = applicableLibraries(version, features)
  const items: DownloadItem[] = []
  const classpath: string[] = []

  for (const lib of libs) {
    const artifact = lib.downloads?.artifact
    if (artifact) {
      items.push({ url: artifact.url, dest: join(dirs.libraries, artifact.path), sha1: artifact.sha1 })
      classpath.push(join(dirs.libraries, artifact.path))
    } else if (lib.name.includes(':')) {
      const rel = libraryRelPath(lib)
      const base = (lib.url ?? LIBRARIES_URL).replace(/\/$/, '')
      items.push({ url: `${base}/${rel}`, dest: join(dirs.libraries, rel) })
      classpath.push(join(dirs.libraries, rel))
    }
  }

  await downloadMany(items, 10, onProgress)
  return classpath
}

interface AssetIndex {
  objects: Record<string, { hash: string; size: number }>
  virtual?: boolean
  map_to_resources?: boolean
}

/** Downloads the asset index + all objects, honouring legacy virtual layouts. */
export async function downloadAssets(
  version: VersionJson,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const index = version.assetIndex
  if (!index) return
  const indexDir = join(dirs.assets, 'indexes')
  const indexFile = join(indexDir, `${index.id}.json`)
  await download(index.url, indexFile, { sha1: index.sha1, verifyExisting: true })

  const data = JSON.parse(readFileSync(indexFile, 'utf8')) as AssetIndex
  const objectsDir = join(dirs.assets, 'objects')
  const items: DownloadItem[] = Object.entries(data.objects).map(([, obj]) => ({
    url: `${RESOURCES_URL}/${obj.hash.slice(0, 2)}/${obj.hash}`,
    dest: join(objectsDir, obj.hash.slice(0, 2), obj.hash),
    sha1: obj.hash
  }))
  await downloadMany(items, 16, onProgress)

  if (data.virtual || data.map_to_resources) {
    buildLegacyResources(index.id, data.objects)
  }
}

/** Recreates the `resources/` layout used by very old (pre-1.7) versions. */
function buildLegacyResources(indexId: string, objects: Record<string, { hash: string }>): void {
  const target = join(dirs.versions, indexId, 'resources')
  mkdirSync(target, { recursive: true })
  for (const [name, obj] of Object.entries(objects)) {
    const src = join(dirs.assets, 'objects', obj.hash.slice(0, 2), obj.hash)
    const dst = join(target, name)
    mkdirSync(join(dst, '..'), { recursive: true })
    if (existsSync(src)) copyFileSync(src, dst)
  }
}

/** Extracts the LWJGL / GLFW natives required at runtime. */
export function extractNatives(version: VersionJson, features: Record<string, boolean>, targetDir: string): void {
  mkdirSync(targetDir, { recursive: true })
  const AdmZip = require('adm-zip') as typeof import('adm-zip')
  for (const lib of applicableLibraries(version, features)) {
    const classifier = nativesClassifier(lib)
    if (!classifier) continue
    const artifact = lib.downloads?.classifiers?.[classifier]
    if (!artifact) continue
    const jarPath = join(dirs.libraries, artifact.path)
    if (!existsSync(jarPath)) continue
    const zip = new AdmZip(jarPath)
    const exclude = lib.extract?.exclude ?? ['META-INF/']
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue
      if (exclude.some((ex) => entry.entryName.startsWith(ex))) continue
      const out = join(targetDir, entry.entryName)
      mkdirSync(join(out, '..'), { recursive: true })
      writeFileSync(out, entry.getData())
    }
  }
}

/** Ensures a version is fully installed (client jar, libraries, assets, natives). */
export async function ensureVersionInstalled(
  version: VersionJson,
  features: Record<string, boolean>,
  onProgress?: (message: string, done: number, total: number) => void
): Promise<{ classpath: string[]; clientJar: string; nativesDir: string }> {
  await downloadClient(version)
  const classpath = await downloadLibraries(version, features, (d, t) => onProgress?.('libraries', d, t))
  await downloadAssets(version, (d, t) => onProgress?.('assets', d, t))
  const nativesDir = join(dirs.versions, version.id, 'natives')
  extractNatives(version, features, nativesDir)
  const clientJar = join(dirs.versions, version.id, `${version.id}.jar`)
  return { classpath, clientJar, nativesDir }
}

/** Lists installed (downloaded) version ids. */
export function installedVersions(): string[] {
  if (!existsSync(dirs.versions)) return []
  return readdirSync(dirs.versions).filter((d) => existsSync(join(dirs.versions, d, `${d}.json`)))
}
