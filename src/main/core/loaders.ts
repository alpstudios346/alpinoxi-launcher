import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { LoaderBuild, LoaderType } from '@shared/types'
import { dirs } from './paths'
import { download, getJson } from './http'
import { getVersionJson, loadVersionJson, type ArgumentValue, type Library, type VersionJson } from './version'

const execFileAsync = promisify(execFile)

const FABRIC_META = 'https://meta.fabricmc.net/v2'
const QUILT_META = 'https://meta.quiltmc.org/v3'
const FORGE_MAVEN = 'https://maven.minecraftforge.net/net/minecraftforge/forge'
const NEOFORGE_MAVEN = 'https://maven.neoforged.net/releases/net/neoforged/neoforge'
const BMCLAPI = 'https://bmclapi2.bangbang93.com'

export const SUPPORTED_LOADERS: LoaderType[] = ['vanilla', 'fabric', 'quilt', 'forge', 'neoforge', 'optifine', 'alpinoxi']

/** Human readable label + whether this loader has a bundled Alpinoxi client profile. */
export const LOADER_LABEL: Record<LoaderType, string> = {
  vanilla: 'Vanilla',
  fabric: 'Fabric',
  quilt: 'Quilt',
  forge: 'Forge',
  neoforge: 'NeoForge',
  optifine: 'OptiFine',
  alpinoxi: 'Alpinoxi (Rust-optimised)'
}

function parseMavenVersions(xml: string): string[] {
  const versions: string[] = []
  const re = /<version>([^<]+)<\/version>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) versions.push(m[1])
  return versions
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'AlpinoxiLauncher/1.0' } })
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
  return res.text()
}

/** NeoForge encodes its own versioning; map a Minecraft version to its prefix. */
function neoforgePrefix(mcVersion: string): string | null {
  if (mcVersion === '1.20.1') return '47.'
  const m = mcVersion.match(/^1\.(\d+)(?:\.(\d+))?$/)
  if (!m) return null
  const minor = parseInt(m[1], 10)
  const patch = m[2] ? parseInt(m[2], 10) : 0
  if (minor === 20 && patch === 1) return '47.'
  return `${minor}.${patch}.`
}

export async function listLoaderBuilds(mcVersion: string, loader: LoaderType): Promise<LoaderBuild[]> {
  try {
    if (loader === 'fabric') {
      const data = await getJson<{ loader: { version: string; stable: boolean } }[]>(
        `${FABRIC_META}/versions/loader/${mcVersion}`
      )
      return data.map((d) => ({ loader, version: d.loader.version, mcVersion, stable: d.loader.stable }))
    }
    if (loader === 'quilt') {
      const data = await getJson<{ loader: { version: string } }[]>(`${QUILT_META}/versions/loader/${mcVersion}`)
      return data.map((d) => ({ loader, version: d.loader.version, mcVersion, stable: true }))
    }
    if (loader === 'forge') {
      const xml = await fetchText(`${FORGE_MAVEN}/maven-metadata.xml`)
      const prefix = `${mcVersion}-`
      return parseMavenVersions(xml)
        .filter((v) => v.startsWith(prefix))
        .map((v) => ({ loader, version: v.slice(prefix.length), mcVersion, stable: true }))
        .reverse()
    }
    if (loader === 'neoforge') {
      const prefix = neoforgePrefix(mcVersion)
      if (!prefix) return []
      const xml = await fetchText(`${NEOFORGE_MAVEN}/maven-metadata.xml`)
      return parseMavenVersions(xml)
        .filter((v) => v.startsWith(prefix))
        .map((v) => ({ loader, version: v, mcVersion, stable: !v.includes('beta') }))
        .reverse()
    }
    if (loader === 'optifine') {
      const data = await getJson<{ type: string; patch: string; filename: string }[]>(`${BMCLAPI}/optifine/${mcVersion}`)
      return data
        .filter((d) => d.filename)
        .map((d) => ({ loader, version: `${d.type}_${d.patch}`, mcVersion, stable: d.type === 'HD_U' }))
    }
  } catch {
    return []
  }
  return []
}

export async function listAllLoaderBuilds(mcVersion: string): Promise<LoaderBuild[]> {
  const loaders: LoaderType[] = ['fabric', 'quilt', 'forge', 'neoforge', 'optifine']
  const results = await Promise.all(loaders.map((l) => listLoaderBuilds(mcVersion, l)))
  return results.flat()
}

/** Merges a loader's version json onto its vanilla parent (inheritsFrom semantics). */
export function mergeVersions(child: VersionJson, parent: VersionJson): VersionJson {
  const dedupeLibraries = (libs: Library[]): Library[] => {
    const seen = new Set<string>()
    const out: Library[] = []
    for (const lib of libs) {
      const key = lib.name
      if (seen.has(key)) continue
      seen.add(key)
      out.push(lib)
    }
    return out
  }

  const concatArgs = (a: ArgumentValue[] = [], b: ArgumentValue[] = []): ArgumentValue[] => [...a, ...b]

  return {
    id: child.id,
    inheritsFrom: undefined,
    type: child.type ?? parent.type,
    mainClass: child.mainClass || parent.mainClass,
    assets: child.assets ?? parent.assets,
    assetIndex: child.assetIndex ?? parent.assetIndex,
    downloads: { ...parent.downloads, ...child.downloads },
    javaVersion: child.javaVersion ?? parent.javaVersion,
    libraries: dedupeLibraries([...child.libraries, ...parent.libraries]),
    arguments: child.arguments
      ? {
          game: concatArgs(child.arguments.game, parent.arguments?.game),
          jvm: concatArgs(child.arguments.jvm, parent.arguments?.jvm)
        }
      : parent.arguments,
    minecraftArguments: child.minecraftArguments ?? parent.minecraftArguments,
    complianceLevel: child.complianceLevel ?? parent.complianceLevel
  }
}

function customVersionId(mcVersion: string, loader: LoaderType, loaderVersion: string): string {
  if (loader === 'vanilla' || loader === 'alpinoxi') return mcVersion
  return `${mcVersion}-${loader}-${loaderVersion.replace(/[^a-zA-Z0-9._-]/g, '')}`
}

async function resolveFabricLike(
  meta: string,
  mcVersion: string,
  loaderVersion: string,
  loader: LoaderType
): Promise<VersionJson> {
  const profile = await getJson<VersionJson>(`${meta}/versions/loader/${mcVersion}/${loaderVersion}/profile/json`)
  const vanilla = await getVersionJson(mcVersion)
  const merged = mergeVersions(profile, vanilla)
  const id = customVersionId(mcVersion, loader, loaderVersion)
  merged.id = id
  const file = join(dirs.versions, id, `${id}.json`)
  mkdirSync(join(dirs.versions, id), { recursive: true })
  writeFileSync(file, JSON.stringify(merged), 'utf8')
  return merged
}

async function runInstaller(
  installerUrl: string,
  installerName: string,
  javaPath: string,
  versionId: string
): Promise<VersionJson> {
  const installer = join(dirs.cache, installerName)
  await download(installerUrl, installer, { retries: 2 })

  // run the forge/neoforge installer straight into a launcher-compatible layout
  const args = ['-jar', installer, '--installClient', dirs.root]
  try {
    await execFileAsync(javaPath, args, { windowsHide: true, timeout: 1000 * 60 * 20 })
  } catch {
    /* some installers exit non-zero even on success */
  }

  const file = join(dirs.versions, versionId, `${versionId}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as VersionJson
  throw new Error(`Loader installer did not produce ${versionId}`)
}

export interface ResolvedLoader {
  versionJson: VersionJson
  versionId: string
}

/** Recursively folds every `inheritsFrom` parent into one flat version json. */
export async function resolveInheritance(json: VersionJson): Promise<VersionJson> {
  if (!json.inheritsFrom) return json
  const parent = await resolveInheritance(await loadVersionJson(json.inheritsFrom))
  return mergeVersions(json, parent)
}

/** Produces a fully merged, launch-ready version json for an instance. */
export async function resolveLoader(
  mcVersion: string,
  loader: LoaderType,
  loaderVersion: string | undefined,
  javaPath: string
): Promise<ResolvedLoader> {
  if (loader === 'vanilla' || loader === 'alpinoxi') {
    const json = await getVersionJson(mcVersion)
    return { versionJson: json, versionId: mcVersion }
  }

  if (loader === 'fabric') {
    const ver = loaderVersion ?? (await listLoaderBuilds(mcVersion, 'fabric'))[0]?.version
    if (!ver) throw new Error('No Fabric loader available for this version')
    const json = await resolveFabricLike(FABRIC_META, mcVersion, ver, 'fabric')
    return { versionJson: json, versionId: json.id }
  }

  if (loader === 'quilt') {
    const ver = loaderVersion ?? (await listLoaderBuilds(mcVersion, 'quilt'))[0]?.version
    if (!ver) throw new Error('No Quilt loader available for this version')
    const json = await resolveFabricLike(QUILT_META, mcVersion, ver, 'quilt')
    return { versionJson: json, versionId: json.id }
  }

  if (loader === 'forge') {
    const ver = loaderVersion ?? (await listLoaderBuilds(mcVersion, 'forge'))[0]?.version
    if (!ver) throw new Error('No Forge build available for this version')
    const id = customVersionId(mcVersion, 'forge', ver)
    const url = `${FORGE_MAVEN}/${mcVersion}-${ver}/forge-${mcVersion}-${ver}-installer.jar`
    const json = await runInstaller(url, `forge-${mcVersion}-${ver}-installer.jar`, javaPath, id)
    return { versionJson: json, versionId: id }
  }

  if (loader === 'neoforge') {
    const ver = loaderVersion ?? (await listLoaderBuilds(mcVersion, 'neoforge'))[0]?.version
    if (!ver) throw new Error('No NeoForge build available for this version')
    const id = customVersionId(mcVersion, 'neoforge', ver)
    const url = `${NEOFORGE_MAVEN}/${ver}/neoforge-${ver}-installer.jar`
    const json = await runInstaller(url, `neoforge-${ver}-installer.jar`, javaPath, id)
    return { versionJson: json, versionId: id }
  }

  if (loader === 'optifine') {
    const builds = await listLoaderBuilds(mcVersion, 'optifine')
    const chosen = loaderVersion ?? builds[0]?.version
    const entry = builds.find((b) => b.version === chosen) ?? builds[0]
    if (!entry) throw new Error('No OptiFine build available for this version')
    // OptiFine ships an installer; we mirror the vanilla + patch approach by
    // launching the installer so it produces a valid version folder.
    const id = customVersionId(mcVersion, 'optifine', entry.version)
    const url = `${BMCLAPI}/optifine/${mcVersion}/${entry.version}`
    const json = await runInstaller(url, `optifine-${mcVersion}-${entry.version}.jar`, javaPath, id)
    return { versionJson: json, versionId: id }
  }

  throw new Error(`Unsupported loader: ${loader}`)
}
