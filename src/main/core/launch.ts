import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Account, GameLogEvent, Instance, ProgressEvent } from '@shared/types'
import { dirs, instanceGameDir, instanceModsDir } from './paths'
import { download } from './http'
import { ensureVersionInstalled, evaluateRules, type ArgumentValue, type VersionJson } from './version'
import { resolveInheritance, resolveLoader } from './loaders'
import { resolveJava } from './java'

export interface LaunchContext {
  onProgress: (e: ProgressEvent) => void
  onLog: (e: GameLogEvent) => void
  onExit: (code: number | null) => void
}

const running = new Map<string, ChildProcess>()

export function runningInstances(): string[] {
  return [...running.keys()]
}

export function isRunning(instanceId: string): boolean {
  return running.has(instanceId)
}

function featureFlags(): Record<string, boolean> {
  return {
    is_demo_user: false,
    has_custom_resolution: false,
    has_quick_plays_support: false,
    is_quick_play_singleplayer: false,
    is_quick_play_multiplayer: false,
    is_quick_play_realms: false
  }
}

function flattenArgs(args: ArgumentValue[] | undefined, features: Record<string, boolean>): string[] {
  if (!args) return []
  const out: string[] = []
  for (const arg of args) {
    if (typeof arg === 'string') out.push(arg)
    else if (evaluateRules(arg.rules, features)) {
      if (Array.isArray(arg.value)) out.push(...arg.value)
      else out.push(arg.value)
    }
  }
  return out
}

function substitute(input: string, vars: Record<string, string>): string {
  return input.replace(/\$\{([^}]+)\}/g, (_, key: string) => vars[key] ?? '')
}

/** Sensible, hardware-agnostic performance flags (skipped if the user set their own). */
function performanceFlags(): string[] {
  return [
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+UseG1GC',
    '-XX:G1NewSizePercent=20',
    '-XX:G1ReservePercent=20',
    '-XX:MaxGCPauseMillis=50',
    '-XX:G1HeapRegionSize=32M',
    '-XX:+ParallelRefProcEnabled',
    '-XX:+DisableExplicitGC',
    '-Dfile.encoding=UTF-8'
  ]
}

async function prepareLogConfig(version: VersionJson): Promise<string | undefined> {
  const logging = version.logging as
    | { client?: { argument?: string; file?: { id: string; url: string } } }
    | undefined
  const file = logging?.client?.file
  if (!file) return undefined
  const dest = join(dirs.assets, 'log_configs', file.id)
  try {
    await download(file.url, dest, { verifyExisting: true })
    return dest
  } catch {
    return undefined
  }
}

export async function launchInstance(
  instance: Instance,
  account: Account,
  ctx: LaunchContext
): Promise<void> {
  if (running.has(instance.id)) throw new Error('Bu kurulum zaten çalışıyor')

  const progress = (phase: ProgressEvent['phase'], message: string, current?: number, total?: number): void =>
    ctx.onProgress({ phase, message, current, total, percent: total ? Math.round(((current ?? 0) / total) * 100) : undefined })

  progress('java', 'Java çalışma zamanı hazırlanıyor…')
  const java = await resolveJava(instance.mcVersion)
  if (!java) throw new Error('Uygun Java bulunamadı ve indirilemedi')

  progress('loader', `${instance.loader} ${instance.loaderVersion ?? ''} hazırlanıyor…`)
  const resolved = await resolveLoader(instance.mcVersion, instance.loader, instance.loaderVersion, java.path)
  const version = await resolveInheritance(resolved.versionJson)

  const features = featureFlags()
  progress('version', 'Sürüm dosyaları doğrulanıyor…')
  const { classpath, clientJar, nativesDir } = await ensureVersionInstalled(version, features, (message, done, total) => {
    progress(message === 'assets' ? 'assets' : 'libraries', message === 'assets' ? 'Varlıklar indiriliyor…' : 'Kütüphaneler indiriliyor…', done, total)
  })

  progress('natives', 'Natives çıkartıldı')
  const gameDir = instanceGameDir(instance.id)
  mkdirSync(gameDir, { recursive: true })
  mkdirSync(instanceModsDir(instance.id), { recursive: true })

  const logConfig = await prepareLogConfig(version)
  const fullClasspath = [...classpath, clientJar].join(process.platform === 'win32' ? ';' : ':')

  const vars: Record<string, string> = {
    natives_directory: nativesDir,
    launcher_name: 'AlpinoxiLauncher',
    launcher_version: '1.0.0',
    classpath: fullClasspath,
    classpath_separator: process.platform === 'win32' ? ';' : ':',
    library_directory: dirs.libraries,
    version_name: resolved.versionId,
    version_type: version.type,
    game_directory: gameDir,
    assets_root: dirs.assets,
    assets_index_name: version.assetIndex?.id ?? version.assets ?? 'legacy',
    auth_player_name: account.username,
    auth_uuid: account.uuid.replace(/-/g, ''),
    auth_access_token: account.accessToken ?? '0',
    auth_session: account.accessToken ?? '0',
    user_type: account.type === 'microsoft' ? 'msa' : 'legacy',
    auth_xuid: '',
    clientid: '',
    user_properties: '{}',
    resolution_width: '1280',
    resolution_height: '720',
    path: logConfig ?? '',
    game_assets: join(dirs.assets, 'virtual', 'legacy')
  }

  const jvmArgs: string[] = []
  jvmArgs.push(`-Xms${instance.memoryMinMb}M`, `-Xmx${instance.memoryMaxMb}M`)
  if (!instance.jvmArgs.some((a) => a.includes('-XX:+Use') || a.includes('-XX:-Use'))) {
    jvmArgs.push(...performanceFlags())
  }
  const rawJvmArgs = flattenArgs(version.arguments?.jvm, features)
  jvmArgs.push(...rawJvmArgs.map((a) => substitute(a, vars)))
  if (!jvmArgs.some((a) => a.includes('java.library.path'))) {
    jvmArgs.push(`-Djava.library.path=${nativesDir}`)
  }
  jvmArgs.push(...instance.jvmArgs.map((a) => substitute(a, vars)))
  if (instance.loader === 'forge' || instance.loader === 'neoforge') {
    jvmArgs.push('-Dfml.ignoreInvalidMinecraftCertificates=true', '-Dfml.ignorePatchDiscrepancies=true')
  }

  let gameArgs: string[]
  if (version.arguments?.game) {
    gameArgs = flattenArgs(version.arguments.game, features).map((a) => substitute(a, vars))
  } else {
    gameArgs = (version.minecraftArguments ?? '')
      .split(' ')
      .filter(Boolean)
      .map((a) => substitute(a, vars))
  }
  gameArgs.push(...instance.gameArgs.map((a) => substitute(a, vars)))

  jvmArgs.push(version.mainClass, ...gameArgs)

  progress('launch', 'Oyun başlatılıyor…')
  ctx.onLog({ instanceId: instance.id, stream: 'launcher', line: `[Alpinoxi] ${java.path} ${jvmArgs.join(' ')}`, at: Date.now() })

  const child = spawn(java.path, jvmArgs, {
    cwd: gameDir,
    windowsHide: false,
    env: { ...process.env }
  })
  running.set(instance.id, child)

  const pipe = (stream: 'stdout' | 'stderr') => (chunk: Buffer): void => {
    for (const line of chunk.toString('utf8').split(/\r?\n/)) {
      if (line.trim()) ctx.onLog({ instanceId: instance.id, stream, line, at: Date.now() })
    }
  }
  child.stdout?.on('data', pipe('stdout'))
  child.stderr?.on('data', pipe('stderr'))
  child.on('error', (err) =>
    ctx.onLog({ instanceId: instance.id, stream: 'launcher', line: `[hata] ${err.message}`, at: Date.now() })
  )
  child.on('close', (code) => {
    running.delete(instance.id)
    ctx.onProgress({ phase: 'done', message: 'Oyun kapandı' })
    ctx.onExit(code)
  })
}

export function stopInstance(instanceId: string): void {
  const child = running.get(instanceId)
  if (!child) return
  try {
    child.kill()
  } catch {
    /* ignore */
  }
  running.delete(instanceId)
}
