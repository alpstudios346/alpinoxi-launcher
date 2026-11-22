import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ModrinthSearchHit, ModrinthVersion } from '@shared/types'
import { instanceModsDir } from './paths'
import { download, getJson } from './http'

const API = 'https://api.modrinth.com/v2'
const UA = 'alpstudios346/alpinoxi-launcher/1.0.0 (contact: github.com/alpstudios346)'

interface RawSearch {
  hits: {
    project_id: string
    slug: string
    title: string
    description: string
    author: string
    downloads: number
    follows: number
    icon_url?: string
    gallery?: string[]
    categories: string[]
    versions: string[]
    loaders: string[]
    project_type: string
  }[]
  total_hits: number
}

function toHit(raw: RawSearch['hits'][number]): ModrinthSearchHit {
  return {
    projectId: raw.project_id,
    slug: raw.slug,
    title: raw.title,
    description: raw.description,
    author: raw.author,
    downloads: raw.downloads,
    follows: raw.follows,
    iconUrl: raw.icon_url,
    gallery: raw.gallery,
    categories: raw.categories,
    versions: raw.versions,
    loaders: raw.loaders,
    projectType: raw.project_type as ModrinthSearchHit['projectType']
  }
}

export async function searchModrinth(
  query: string,
  opts: { mcVersion?: string; loader?: string; projectType?: string; limit?: number; offset?: number } = {}
): Promise<{ hits: ModrinthSearchHit[]; totalHits: number }> {
  const facets: string[][] = []
  facets.push([`project_type:${opts.projectType ?? 'mod'}`])
  if (opts.mcVersion) facets.push([`versions:${opts.mcVersion}`])
  if (opts.loader && opts.loader !== 'vanilla') {
    const loader = opts.loader === 'alpinoxi' ? 'fabric' : opts.loader
    facets.push([`categories:${loader}`])
  }
  const params = new URLSearchParams({
    query,
    limit: String(opts.limit ?? 20),
    offset: String(opts.offset ?? 0),
    index: 'relevance'
  })
  if (facets.length) params.set('facets', JSON.stringify(facets))
  const data = await getJson<RawSearch>(`${API}/search?${params.toString()}`, { 'User-Agent': UA })
  return { hits: data.hits.map(toHit), totalHits: data.total_hits }
}

export async function getProject(idOrSlug: string): Promise<ModrinthSearchHit> {
  const raw = await getJson<{
    project_id: string
    slug: string
    title: string
    description: string
    team: string
    downloads: number
    followers: number
    icon_url?: string
    gallery?: { url: string }[]
    categories: string[]
    versions: string[]
    loaders: string[]
    project_type: string
  }>(`${API}/project/${idOrSlug}`, { 'User-Agent': UA })
  return {
    projectId: raw.project_id,
    slug: raw.slug,
    title: raw.title,
    description: raw.description,
    author: raw.team,
    downloads: raw.downloads,
    follows: raw.followers,
    iconUrl: raw.icon_url,
    gallery: raw.gallery?.map((g) => g.url),
    categories: raw.categories,
    versions: raw.versions,
    loaders: raw.loaders,
    projectType: raw.project_type as ModrinthSearchHit['projectType']
  }
}

interface RawVersion {
  id: string
  project_id: string
  name: string
  version_number: string
  game_versions: string[]
  loaders: string[]
  files: { url: string; filename: string; size: number; primary: boolean }[]
  dependencies: { project_id?: string; version_id?: string; dependency_type: string }[]
}

export async function getVersions(
  idOrSlug: string,
  opts: { mcVersion?: string; loader?: string } = {}
): Promise<ModrinthVersion[]> {
  const params: Record<string, string> = {}
  if (opts.mcVersion) params.game_versions = JSON.stringify([opts.mcVersion])
  if (opts.loader && opts.loader !== 'vanilla') {
    params.loaders = JSON.stringify([opts.loader === 'alpinoxi' ? 'fabric' : opts.loader])
  }
  const qs = new URLSearchParams(params).toString()
  const list = await getJson<RawVersion[]>(`${API}/project/${idOrSlug}/version${qs ? `?${qs}` : ''}`, {
    'User-Agent': UA
  })
  return list.map((v) => ({
    id: v.id,
    projectId: v.project_id,
    name: v.name,
    versionNumber: v.version_number,
    gameVersions: v.game_versions,
    loaders: v.loaders,
    files: v.files.map((f) => ({ url: f.url, filename: f.filename, size: f.size, primary: f.primary })),
    dependencies: v.dependencies.map((d) => ({
      projectId: d.project_id,
      versionId: d.version_id,
      dependencyType: d.dependency_type
    }))
  }))
}

export async function getVersionById(versionId: string): Promise<ModrinthVersion | null> {
  try {
    const v = await getJson<RawVersion>(`${API}/version/${versionId}`, { 'User-Agent': UA })
    return {
      id: v.id,
      projectId: v.project_id,
      name: v.name,
      versionNumber: v.version_number,
      gameVersions: v.game_versions,
      loaders: v.loaders,
      files: v.files.map((f) => ({ url: f.url, filename: f.filename, size: f.size, primary: f.primary })),
      dependencies: v.dependencies.map((d) => ({
        projectId: d.project_id,
        versionId: d.version_id,
        dependencyType: d.dependency_type
      }))
    }
  } catch {
    return null
  }
}

/** Picks the best file for the current loader and downloads it into mods/. */
export async function installVersion(instanceId: string, version: ModrinthVersion): Promise<string> {
  const file = version.files.find((f) => f.primary) ?? version.files[0]
  if (!file) throw new Error('Bu sürüm için indirilebilir dosya yok')
  const modsDir = instanceModsDir(instanceId)
  if (!existsSync(modsDir)) mkdirSync(modsDir, { recursive: true })
  const dest = join(modsDir, file.filename)
  await download(file.url, dest, { size: file.size, retries: 2 })
  return file.filename
}

/** Downloads a version + its required dependencies (depth-limited). */
export async function installWithDependencies(
  instanceId: string,
  version: ModrinthVersion,
  mcVersion: string,
  loader: string,
  seen = new Set<string>(),
  depth = 0
): Promise<string[]> {
  if (depth > 4) return []
  const installed: string[] = []
  try {
    installed.push(await installVersion(instanceId, version))
  } catch {
    return installed
  }
  seen.add(version.projectId)

  for (const dep of version.dependencies.filter((d) => d.dependencyType === 'required')) {
    if (dep.projectId && seen.has(dep.projectId)) continue
    try {
      const depVersions = await getVersions(dep.projectId!, { mcVersion, loader })
      const chosen = dep.versionId
        ? depVersions.find((v) => v.id === dep.versionId) ?? depVersions[0]
        : depVersions[0]
      if (chosen) {
        installed.push(...(await installWithDependencies(instanceId, chosen, mcVersion, loader, seen, depth + 1)))
      }
    } catch {
      /* ignore failed dependency */
    }
  }
  return installed
}
