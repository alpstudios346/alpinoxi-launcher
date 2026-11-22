import { contextBridge, ipcRenderer } from 'electron'
import { IPC, EVENTS } from '@shared/ipc'
import type { AlpinoxiApi, SocialPayload, ToastPayload } from '@shared/ipc'
import type {
  Account,
  AppSettings,
  GameLogEvent,
  Instance,
  LoaderType,
  ProgressEvent,
  YoutubeVideoUpload
} from '@shared/types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: AlpinoxiApi = {
  app: {
    info: () => ipcRenderer.invoke(IPC.app.info),
    openExternal: (url) => ipcRenderer.invoke(IPC.app.openExternal, url),
    openPath: (p) => ipcRenderer.invoke(IPC.app.openPath, p),
    relaunch: () => ipcRenderer.invoke(IPC.app.relaunch),
    minimize: () => ipcRenderer.invoke(IPC.app.minimize),
    maximize: () => ipcRenderer.invoke(IPC.app.maximize),
    close: () => ipcRenderer.invoke(IPC.app.close)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settings.get),
    set: (patch: Partial<AppSettings>) => ipcRenderer.invoke(IPC.settings.set, patch)
  },
  java: {
    list: () => ipcRenderer.invoke(IPC.java.list),
    resolve: (mcVersion: string) => ipcRenderer.invoke(IPC.java.resolve, mcVersion),
    download: (major: number) => ipcRenderer.invoke(IPC.java.download, major)
  },
  versions: {
    list: () => ipcRenderer.invoke(IPC.versions.list),
    loaders: (mcVersion: string) => ipcRenderer.invoke(IPC.versions.loaders, mcVersion)
  },
  instances: {
    list: () => ipcRenderer.invoke(IPC.instances.list),
    create: (input: Partial<Instance> & { name: string; mcVersion: string; loader: LoaderType }) =>
      ipcRenderer.invoke(IPC.instances.create, input),
    update: (id: string, patch: Partial<Instance>) => ipcRenderer.invoke(IPC.instances.update, id, patch),
    remove: (id: string) => ipcRenderer.invoke(IPC.instances.remove, id),
    duplicate: (id: string) => ipcRenderer.invoke(IPC.instances.duplicate, id),
    mods: (id: string) => ipcRenderer.invoke(IPC.instances.mods, id),
    removeMod: (id: string, filename: string) => ipcRenderer.invoke(IPC.instances.removeMod, id, filename)
  },
  auth: {
    list: () => ipcRenderer.invoke(IPC.auth.list),
    offline: (username: string) => ipcRenderer.invoke(IPC.auth.offline, username),
    remove: (id: string) => ipcRenderer.invoke(IPC.auth.remove, id),
    setCurrent: (id: string) => ipcRenderer.invoke(IPC.auth.setCurrent, id),
    current: () => ipcRenderer.invoke(IPC.auth.current),
    microsoftStart: () => ipcRenderer.invoke(IPC.auth.microsoftStart),
    microsoftPoll: (deviceCode: string) => ipcRenderer.invoke(IPC.auth.microsoftPoll, deviceCode),
    elybyStart: () => ipcRenderer.invoke(IPC.auth.elybyStart),
    elybyComplete: () => ipcRenderer.invoke(IPC.auth.elybyComplete),
    elybySession: () => ipcRenderer.invoke(IPC.auth.elybySession),
    uploadSkin: (filePath: string, variant: 'classic' | 'slim') =>
      ipcRenderer.invoke(IPC.auth.uploadSkin, filePath, variant)
  },
  launch: {
    start: (instanceId: string) => ipcRenderer.invoke(IPC.launch.start, instanceId),
    stop: (instanceId: string) => ipcRenderer.invoke(IPC.launch.stop, instanceId),
    running: () => ipcRenderer.invoke(IPC.launch.running)
  },
  modrinth: {
    search: (query, opts) => ipcRenderer.invoke(IPC.modrinth.search, query, opts),
    project: (idOrSlug: string) => ipcRenderer.invoke(IPC.modrinth.project, idOrSlug),
    versions: (idOrSlug, opts) => ipcRenderer.invoke(IPC.modrinth.versions, idOrSlug, opts),
    install: (instanceId: string, version) => ipcRenderer.invoke(IPC.modrinth.install, instanceId, version)
  },
  modpack: {
    createFromInstance: (instanceId: string, name: string, includeClient: boolean) =>
      ipcRenderer.invoke(IPC.modpack.createFromInstance, instanceId, name, includeClient),
    createStandalone: (input) => ipcRenderer.invoke(IPC.modpack.createStandalone, input),
    export: (instanceId: string) => ipcRenderer.invoke(IPC.modpack.export, instanceId),
    import: () => ipcRenderer.invoke(IPC.modpack.import)
  },
  cosmetics: {
    list: () => ipcRenderer.invoke(IPC.cosmetics.list),
    equipped: () => ipcRenderer.invoke(IPC.cosmetics.equipped),
    equip: (category: string, itemId?: string) => ipcRenderer.invoke(IPC.cosmetics.equip, category, itemId),
    uploadSkin: (filePath: string) => ipcRenderer.invoke(IPC.cosmetics.uploadSkin, filePath),
    uploadCape: (filePath: string) => ipcRenderer.invoke(IPC.cosmetics.uploadCape, filePath),
    animated: (filePath: string) => ipcRenderer.invoke(IPC.cosmetics.animated, filePath),
    openElyby: () => ipcRenderer.invoke(IPC.cosmetics.openElyby)
  },
  hud: {
    get: () => ipcRenderer.invoke(IPC.hud.get),
    set: (patch) => ipcRenderer.invoke(IPC.hud.set, patch)
  },
  social: {
    connect: () => ipcRenderer.invoke(IPC.social.connect),
    disconnect: () => ipcRenderer.invoke(IPC.social.disconnect),
    friends: () => ipcRenderer.invoke(IPC.social.friends),
    addFriend: (username: string) => ipcRenderer.invoke(IPC.social.addFriend, username),
    removeFriend: (id: string) => ipcRenderer.invoke(IPC.social.removeFriend, id),
    partyCreate: () => ipcRenderer.invoke(IPC.social.partyCreate),
    partyJoin: (code: string) => ipcRenderer.invoke(IPC.social.partyJoin, code),
    partyLeave: () => ipcRenderer.invoke(IPC.social.partyLeave),
    partyState: () => ipcRenderer.invoke(IPC.social.partyState)
  },
  youtube: {
    authStart: () => ipcRenderer.invoke(IPC.youtube.authStart),
    authComplete: () => ipcRenderer.invoke(IPC.youtube.authComplete),
    channels: () => ipcRenderer.invoke(IPC.youtube.channels),
    upload: (input: YoutubeVideoUpload) => ipcRenderer.invoke(IPC.youtube.upload, input)
  },
  on: {
    progress: (cb: (e: ProgressEvent) => void) => subscribe(EVENTS.progress, cb),
    gameLog: (cb: (e: GameLogEvent) => void) => subscribe(EVENTS.gameLog, cb),
    gameExit: (cb: (e: { instanceId: string; code: number | null }) => void) => subscribe(EVENTS.gameExit, cb),
    instanceUpdate: (cb: (e: Instance) => void) => subscribe(EVENTS.instanceUpdate, cb),
    socialUpdate: (cb: (e: SocialPayload) => void) => subscribe(EVENTS.socialUpdate, cb),
    accountUpdate: (cb: (e: Account[]) => void) => subscribe(EVENTS.accountUpdate, cb),
    youtubeUploadProgress: (cb: (e: { percent: number }) => void) => subscribe(EVENTS.youtubeUploadProgress, cb),
    toast: (cb: (e: ToastPayload) => void) => subscribe(EVENTS.toast, cb)
  }
}

contextBridge.exposeInMainWorld('alpinoxi', api)
