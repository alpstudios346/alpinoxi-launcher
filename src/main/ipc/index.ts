import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IPC, EVENTS } from '@shared/ipc'
import type { AppInfo, AppSettings, Instance, LoaderType, YoutubeVideoUpload } from '@shared/types'
import { dataRoot, dirs, setDataRoot } from '../core/paths'
import { getSettings, updateSettings } from '../core/settings'
import { listJava, downloadJava, resolveJava } from '../core/java'
import { getManifest } from '../core/version'
import { listAllLoaderBuilds } from '../core/loaders'
import {
  createInstance,
  duplicateInstance,
  getInstance,
  listInstances,
  listMods,
  removeInstance,
  removeMod,
  updateInstance
} from '../core/install'
import {
  createOfflineAccount,
  currentAccount,
  elybyComplete,
  elybyCosmeticsWindow,
  elybySession,
  elybyStart,
  listAccounts,
  microsoftPoll,
  microsoftStart,
  removeAccount,
  setCurrentAccount
} from '../core/auth'
import { launchInstance, runningInstances, stopInstance } from '../core/launch'
import { getProject, getVersions, installWithDependencies, searchModrinth } from '../core/modrinth'
import { createFromInstance, createStandalone, exportModpack, importModpack } from '../core/modpack'
import {
  equipCosmetic,
  getEquipped,
  listCosmetics,
  processAnimated,
  uploadCapeFile,
  uploadSkinFile
} from '../core/cosmetics'
import { getHud, setHud } from '../core/hud'
import {
  activeBridgeInstance,
  onBridgeUpdate,
  pullBridge,
  pushBridge,
  readBridge,
  setBridgeInstance
} from '../core/bridge'
import {
  addFriend,
  connectSocial,
  createParty,
  disconnectSocial,
  joinParty,
  leaveParty,
  onSocialUpdate,
  removeFriend,
  socialState
} from '../core/social'
import { youtubeAuthComplete, youtubeAuthStart, youtubeChannels, youtubeUpload } from '../core/youtube'

let win: BrowserWindow | null = null

export function setWindow(w: BrowserWindow): void {
  win = w
}

function send(channel: string, payload: unknown): void {
  win?.webContents.send(channel, payload)
}

async function pickFile(filters: Electron.FileFilter[]): Promise<string | null> {
  if (!win) return null
  const res = await dialog.showOpenDialog(win, { properties: ['openFile'], filters })
  return res.canceled ? null : res.filePaths[0] ?? null
}

export function registerIpc(): void {
  onSocialUpdate((payload) => {
    send(EVENTS.socialUpdate, payload)
    pushBridge()
  })
  onBridgeUpdate((snapshot) => send(EVENTS.bridgeUpdate, snapshot))

  // ---- app -----------------------------------------------------------------
  ipcMain.handle(IPC.app.info, (): AppInfo => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    dataDir: dataRoot(),
    versionsDir: dirs.versions,
    instancesDir: dirs.instances
  }))
  ipcMain.handle(IPC.app.openExternal, (_e, url: string) => shell.openExternal(url))
  ipcMain.handle(IPC.app.openPath, (_e, p: string) => shell.openPath(p))
  ipcMain.handle(IPC.app.relaunch, () => {
    app.relaunch()
    app.exit(0)
  })
  ipcMain.handle(IPC.app.minimize, () => win?.minimize())
  ipcMain.handle(IPC.app.maximize, () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()))
  ipcMain.handle(IPC.app.close, () => win?.close())

  // ---- settings ------------------------------------------------------------
  ipcMain.handle(IPC.settings.get, (): AppSettings => getSettings())
  ipcMain.handle(IPC.settings.set, (_e, patch: Partial<AppSettings>): AppSettings => {
    const next = updateSettings(patch)
    if (patch.dataDir) setDataRoot(patch.dataDir)
    return next
  })

  // ---- java ----------------------------------------------------------------
  ipcMain.handle(IPC.java.list, () => listJava())
  ipcMain.handle(IPC.java.resolve, (_e, mc: string) => resolveJava(mc))
  ipcMain.handle(IPC.java.download, (_e, major: number) => downloadJava(major))

  // ---- versions ------------------------------------------------------------
  ipcMain.handle(IPC.versions.list, async () => {
    const manifest = await getManifest()
    const showSnapshots = getSettings().showSnapshots
    return manifest.versions
      .filter((v) => showSnapshots || v.type === 'release')
      .map((v) => ({ id: v.id, type: v.type, releaseTime: v.releaseTime, url: v.url }))
  })
  ipcMain.handle(IPC.versions.loaders, (_e, mc: string) => listAllLoaderBuilds(mc))

  // ---- instances -----------------------------------------------------------
  ipcMain.handle(IPC.instances.list, () => listInstances())
  ipcMain.handle(IPC.instances.create, (_e, input: Partial<Instance> & { name: string; mcVersion: string; loader: LoaderType }) =>
    createInstance(input)
  )
  ipcMain.handle(IPC.instances.update, (_e, id: string, patch: Partial<Instance>) => updateInstance(id, patch))
  ipcMain.handle(IPC.instances.remove, (_e, id: string) => removeInstance(id))
  ipcMain.handle(IPC.instances.duplicate, (_e, id: string) => duplicateInstance(id))
  ipcMain.handle(IPC.instances.mods, (_e, id: string) => listMods(id))
  ipcMain.handle(IPC.instances.removeMod, (_e, id: string, filename: string) => removeMod(id, filename))

  // ---- auth ----------------------------------------------------------------
  ipcMain.handle(IPC.auth.list, () => listAccounts())
  ipcMain.handle(IPC.auth.offline, (_e, username: string) => createOfflineAccount(username))
  ipcMain.handle(IPC.auth.remove, (_e, id: string) => removeAccount(id))
  ipcMain.handle(IPC.auth.setCurrent, (_e, id: string) => setCurrentAccount(id))
  ipcMain.handle(IPC.auth.current, () => currentAccount())
  ipcMain.handle(IPC.auth.microsoftStart, () => microsoftStart())
  ipcMain.handle(IPC.auth.microsoftPoll, (_e, deviceCode: string) => microsoftPoll(deviceCode))
  ipcMain.handle(IPC.auth.elybyStart, () => elybyStart(win ?? undefined))
  ipcMain.handle(IPC.auth.elybyComplete, () => elybyComplete())
  ipcMain.handle(IPC.auth.elybySession, () => elybySession())
  ipcMain.handle(IPC.auth.uploadSkin, async (_e, filePath: string, variant: 'classic' | 'slim') => {
    const account = currentAccount()
    if (!account) throw new Error('Önce giriş yapın')
    if (account.type === 'microsoft' && account.accessToken) {
      const { readFileSync } = await import('node:fs')
      const form = new FormData()
      form.append('variant', variant)
      form.append('file', new Blob([readFileSync(filePath)], { type: 'image/png' }), 'skin.png')
      const res = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
        method: 'POST',
        headers: { Authorization: `Bearer ${account.accessToken}` },
        body: form
      })
      if (!res.ok) throw new Error(`Skin yüklenemedi (${res.status})`)
    } else {
      uploadSkinFile(filePath, variant)
    }
    pushBridge()
  })

  // ---- launch --------------------------------------------------------------
  ipcMain.handle(IPC.launch.start, async (_e, instanceId: string) => {
    const instance = getInstance(instanceId)
    if (!instance) throw new Error('Kurulum bulunamadı')
    const account = instance.accountId
      ? listAccounts().find((a) => a.id === instance.accountId) ?? currentAccount()
      : currentAccount()
    if (!account) throw new Error('Önce bir hesap ekleyin')
    // Oyun içi modülle senkron için köprü hedefini ayarla ve mevcut durumu yaz.
    setBridgeInstance(instanceId)
    pushBridge(instanceId)
    const startedAt = Date.now()
    await launchInstance(instance, account, {
      onProgress: (e) => send(EVENTS.progress, e),
      onLog: (e) => {
        send(EVENTS.gameLog, e)
        // Oyun açılırken modun yazdığı değişiklikleri yakala.
        if (e.stream === 'launcher') pullBridge(instanceId)
      },
      onExit: (code) => {
        pullBridge(instanceId)
        setBridgeInstance(null)
        send(EVENTS.gameExit, { instanceId, code })
        const updated = updateInstance(instanceId, {
          lastPlayedAt: Date.now(),
          playtimeMs: (instance.playtimeMs ?? 0) + (Date.now() - startedAt)
        })
        send(EVENTS.instanceUpdate, updated)
      }
    })
    updateInstance(instanceId, { lastPlayedAt: Date.now() })
  })
  ipcMain.handle(IPC.launch.stop, (_e, instanceId: string) => stopInstance(instanceId))
  ipcMain.handle(IPC.launch.running, () => runningInstances())

  // ---- modrinth ------------------------------------------------------------
  ipcMain.handle(IPC.modrinth.search, (_e, query: string, opts) => searchModrinth(query, opts ?? {}))
  ipcMain.handle(IPC.modrinth.project, (_e, idOrSlug: string) => getProject(idOrSlug))
  ipcMain.handle(IPC.modrinth.versions, (_e, idOrSlug: string, opts) => getVersions(idOrSlug, opts ?? {}))
  ipcMain.handle(IPC.modrinth.install, async (_e, instanceId: string, version) => {
    const instance = getInstance(instanceId)
    if (!instance) throw new Error('Kurulum bulunamadı')
    send(EVENTS.progress, { phase: 'mods', message: 'Mod indiriliyor…' })
    await installWithDependencies(instanceId, version, instance.mcVersion, instance.loader)
    send(EVENTS.progress, { phase: 'done', message: 'Mod kuruldu' })
  })

  // ---- modpack -------------------------------------------------------------
  ipcMain.handle(IPC.modpack.createFromInstance, (_e, instanceId: string, name: string, includeClient: boolean) =>
    createFromInstance(instanceId, name, includeClient, (e) => send(EVENTS.progress, e))
  )
  ipcMain.handle(IPC.modpack.createStandalone, (_e, input) =>
    createStandalone(input, (e) => send(EVENTS.progress, e))
  )
  ipcMain.handle(IPC.modpack.export, async (_e, instanceId: string) => {
    if (!win) return null
    const instance = getInstance(instanceId)
    const res = await dialog.showSaveDialog(win, {
      defaultPath: `${instance?.name ?? 'modpack'}.mrpack`,
      filters: [{ name: 'Modrinth Modpack', extensions: ['mrpack'] }]
    })
    if (res.canceled || !res.filePath) return null
    return exportModpack(instanceId, res.filePath)
  })
  ipcMain.handle(IPC.modpack.import, async () => {
    const file = await pickFile([{ name: 'Modrinth Modpack', extensions: ['mrpack', 'zip'] }])
    if (!file) return null
    return importModpack(file, (e) => send(EVENTS.progress, e))
  })

  // ---- cosmetics -----------------------------------------------------------
  ipcMain.handle(IPC.cosmetics.list, () => listCosmetics())
  ipcMain.handle(IPC.cosmetics.equipped, () => getEquipped())
  ipcMain.handle(IPC.cosmetics.equip, (_e, category: string, itemId?: string) => equipCosmetic(category, itemId))
  ipcMain.handle(IPC.cosmetics.uploadSkin, async () => {
    const file = await pickFile([{ name: 'PNG', extensions: ['png'] }])
    if (!file) return null
    const result = uploadSkinFile(file)
    pushBridge()
    return result
  })
  ipcMain.handle(IPC.cosmetics.uploadCape, async () => {
    const file = await pickFile([{ name: 'PNG', extensions: ['png'] }])
    if (!file) return null
    return uploadCapeFile(file)
  })
  ipcMain.handle(IPC.cosmetics.animated, async () => {
    const file = await pickFile([{ name: 'PNG', extensions: ['png'] }])
    if (!file) return null
    return processAnimated(file)
  })
  ipcMain.handle(IPC.cosmetics.openElyby, () => {
    if (win) elybyCosmeticsWindow(win)
  })

  // ---- hud -----------------------------------------------------------------
  ipcMain.handle(IPC.hud.get, () => {
    pullBridge()
    return getHud()
  })
  ipcMain.handle(IPC.hud.set, (_e, patch) => {
    const next = setHud(patch)
    pushBridge()
    return next
  })

  // ---- social --------------------------------------------------------------
  ipcMain.handle(IPC.social.connect, () => {
    connectSocial()
  })
  ipcMain.handle(IPC.social.disconnect, () => disconnectSocial())
  ipcMain.handle(IPC.social.friends, () => {
    pullBridge()
    return socialState().friends
  })
  ipcMain.handle(IPC.social.addFriend, (_e, username: string) => addFriend(username))
  ipcMain.handle(IPC.social.removeFriend, (_e, id: string) => removeFriend(id))
  ipcMain.handle(IPC.social.partyCreate, () => createParty())
  ipcMain.handle(IPC.social.partyJoin, (_e, code: string) => joinParty(code))
  ipcMain.handle(IPC.social.partyLeave, () => leaveParty())
  ipcMain.handle(IPC.social.partyState, () => {
    pullBridge()
    return socialState()
  })

  // ---- bridge --------------------------------------------------------------
  ipcMain.handle(IPC.bridge.push, (_e, instanceId?: string) => {
    pushBridge(instanceId ?? activeBridgeInstance())
  })
  ipcMain.handle(IPC.bridge.pull, (_e, instanceId?: string) => {
    const target = instanceId ?? activeBridgeInstance()
    const changed = pullBridge(target)
    return changed
  })
  ipcMain.handle(IPC.bridge.state, () => {
    const target = activeBridgeInstance()
    pullBridge(target)
    return { hud: getHud(), social: socialState(), skin: target ? readBridge(target)?.skin ?? null : null }
  })

  // ---- youtube -------------------------------------------------------------
  ipcMain.handle(IPC.youtube.authStart, () => youtubeAuthStart())
  ipcMain.handle(IPC.youtube.authComplete, () => youtubeAuthComplete())
  ipcMain.handle(IPC.youtube.channels, () => youtubeChannels())
  ipcMain.handle(IPC.youtube.upload, async (_e, input: YoutubeVideoUpload) => {
    const filePath = input.filePath || (await pickFile([{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'webm'] }]))
    if (!filePath) throw new Error('Video seçilmedi')
    return youtubeUpload({ ...input, filePath }, (percent) => send(EVENTS.youtubeUploadProgress, { percent }))
  })
}
