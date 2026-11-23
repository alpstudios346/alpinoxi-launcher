import type {
  Account,
  AppInfo,
  AppSettings,
  CosmeticItem,
  EquippedCosmetics,
  Friend,
  GameLogEvent,
  HudConfig,
  Instance,
  JavaRuntime,
  LoaderBuild,
  LoaderType,
  MinecraftVersion,
  ModrinthSearchHit,
  ModrinthVersion,
  Party,
  ProgressEvent,
  YoutubeChannel,
  YoutubeVideoUpload
} from './types'

/** Every request/response channel used by `ipcRenderer.invoke`. */
export const IPC = {
  app: {
    info: 'app:info',
    openExternal: 'app:openExternal',
    openPath: 'app:openPath',
    relaunch: 'app:relaunch',
    minimize: 'app:minimize',
    maximize: 'app:maximize',
    close: 'app:close'
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set'
  },
  java: {
    list: 'java:list',
    resolve: 'java:resolve',
    download: 'java:download'
  },
  versions: {
    list: 'versions:list',
    loaders: 'versions:loaders'
  },
  instances: {
    list: 'instances:list',
    create: 'instances:create',
    update: 'instances:update',
    remove: 'instances:remove',
    duplicate: 'instances:duplicate',
    mods: 'instances:mods',
    removeMod: 'instances:removeMod'
  },
  auth: {
    list: 'auth:list',
    offline: 'auth:offline',
    remove: 'auth:remove',
    setCurrent: 'auth:setCurrent',
    current: 'auth:current',
    microsoftStart: 'auth:microsoft:start',
    microsoftPoll: 'auth:microsoft:poll',
    elybyStart: 'auth:elyby:start',
    elybyComplete: 'auth:elyby:complete',
    elybySession: 'auth:elyby:session',
    uploadSkin: 'auth:uploadSkin'
  },
  launch: {
    start: 'launch:start',
    stop: 'launch:stop',
    running: 'launch:running'
  },
  modrinth: {
    search: 'modrinth:search',
    project: 'modrinth:project',
    versions: 'modrinth:versions',
    install: 'modrinth:install'
  },
  modpack: {
    createFromInstance: 'modpack:createFromInstance',
    createStandalone: 'modpack:createStandalone',
    export: 'modpack:export',
    import: 'modpack:import'
  },
  cosmetics: {
    list: 'cosmetics:list',
    equipped: 'cosmetics:equipped',
    equip: 'cosmetics:equip',
    uploadSkin: 'cosmetics:uploadSkin',
    uploadCape: 'cosmetics:uploadCape',
    animated: 'cosmetics:animated',
    openElyby: 'cosmetics:openElyby'
  },
  hud: {
    get: 'hud:get',
    set: 'hud:set'
  },
  social: {
    connect: 'social:connect',
    disconnect: 'social:disconnect',
    friends: 'social:friends',
    addFriend: 'social:addFriend',
    removeFriend: 'social:removeFriend',
    partyCreate: 'social:party:create',
    partyJoin: 'social:party:join',
    partyLeave: 'social:party:leave',
    partyState: 'social:party:state'
  },
  bridge: {
    push: 'bridge:push',
    pull: 'bridge:pull',
    state: 'bridge:state'
  },
  youtube: {
    authStart: 'youtube:auth:start',
    authComplete: 'youtube:auth:complete',
    channels: 'youtube:channels',
    upload: 'youtube:upload',
    uploadProgress: 'youtube:upload:progress'
  }
} as const

/** Push-style events emitted from main -> renderer. */
export const EVENTS = {
  progress: 'event:progress',
  gameLog: 'event:gameLog',
  gameExit: 'event:gameExit',
  instanceUpdate: 'event:instanceUpdate',
  socialUpdate: 'event:socialUpdate',
  accountUpdate: 'event:accountUpdate',
  youtubeUploadProgress: 'event:youtubeUploadProgress',
  bridgeUpdate: 'event:bridgeUpdate',
  toast: 'event:toast'
} as const

export interface SocialPayload {
  friends: Friend[]
  party: Party | null
  connected: boolean
  selfId?: string
}

export interface BridgeSkin {
  path: string
  model: string
  username: string
}

/** Launcher tarafından okunan birleşik köprü durumu (oyun içi modülle paylaşılır). */
export interface BridgeSnapshot {
  hud: HudConfig
  social: SocialPayload
  skin?: BridgeSkin | null
}

export interface ToastPayload {
  type: 'info' | 'success' | 'error'
  message: string
}

/** The API surface exposed on `window.alpinoxi` by the preload script. */
export interface AlpinoxiApi {
  app: {
    info(): Promise<AppInfo>
    openExternal(url: string): Promise<void>
    openPath(p: string): Promise<void>
    relaunch(): Promise<void>
    minimize(): Promise<void>
    maximize(): Promise<void>
    close(): Promise<void>
  }
  settings: {
    get(): Promise<AppSettings>
    set(patch: Partial<AppSettings>): Promise<AppSettings>
  }
  java: {
    list(): Promise<JavaRuntime[]>
    resolve(mcVersion: string): Promise<JavaRuntime | null>
    download(major: number): Promise<JavaRuntime>
  }
  versions: {
    list(): Promise<MinecraftVersion[]>
    loaders(mcVersion: string): Promise<LoaderBuild[]>
  }
  instances: {
    list(): Promise<Instance[]>
    create(input: Partial<Instance> & { name: string; mcVersion: string; loader: LoaderType }): Promise<Instance>
    update(id: string, patch: Partial<Instance>): Promise<Instance>
    remove(id: string): Promise<void>
    duplicate(id: string): Promise<Instance>
    mods(id: string): Promise<string[]>
    removeMod(id: string, filename: string): Promise<void>
  }
  auth: {
    list(): Promise<Account[]>
    offline(username: string): Promise<Account>
    remove(id: string): Promise<void>
    setCurrent(id: string): Promise<void>
    current(): Promise<Account | null>
    microsoftStart(): Promise<{ userCode: string; verificationUri: string; deviceCode: string; interval: number; expiresIn: number }>
    microsoftPoll(deviceCode: string): Promise<Account | null>
    elybyStart(): Promise<void>
    elybyComplete(): Promise<Account | null>
    elybySession(): Promise<{ signedIn: boolean; username?: string }>
    uploadSkin(filePath: string, variant: 'classic' | 'slim'): Promise<void>
  }
  launch: {
    start(instanceId: string): Promise<void>
    stop(instanceId: string): Promise<void>
    running(): Promise<string[]>
  }
  modrinth: {
    search(query: string, opts?: { mcVersion?: string; loader?: string; projectType?: string; limit?: number; offset?: number }): Promise<{ hits: ModrinthSearchHit[]; totalHits: number }>
    project(idOrSlug: string): Promise<ModrinthSearchHit>
    versions(idOrSlug: string, opts?: { mcVersion?: string; loader?: string }): Promise<ModrinthVersion[]>
    install(instanceId: string, version: ModrinthVersion): Promise<void>
  }
  modpack: {
    createFromInstance(instanceId: string, name: string, includeClient: boolean): Promise<string>
    createStandalone(input: { name: string; mcVersion: string; loader: LoaderType; loaderVersion?: string; includeClient: boolean; modsFromInstance?: string }): Promise<Instance>
    export(instanceId: string): Promise<string | null>
    import(): Promise<Instance | null>
  }
  cosmetics: {
    list(): Promise<CosmeticItem[]>
    equipped(): Promise<EquippedCosmetics>
    equip(category: string, itemId: string | undefined): Promise<EquippedCosmetics>
    uploadSkin(filePath: string): Promise<{ url: string; animated: boolean }>
    uploadCape(filePath: string): Promise<{ url: string; animated: boolean }>
    animated(filePath: string): Promise<{ url: string; frames: number }>
    openElyby(): Promise<void>
  }
  hud: {
    get(): Promise<HudConfig>
    set(patch: Partial<HudConfig>): Promise<HudConfig>
  }
  social: {
    connect(): Promise<void>
    disconnect(): Promise<void>
    friends(): Promise<Friend[]>
    addFriend(username: string): Promise<Friend[]>
    removeFriend(id: string): Promise<Friend[]>
    partyCreate(): Promise<Party>
    partyJoin(code: string): Promise<Party>
    partyLeave(): Promise<void>
    partyState(): Promise<SocialPayload>
  }
  bridge: {
    push(instanceId?: string): Promise<void>
    pull(instanceId?: string): Promise<boolean>
    state(): Promise<BridgeSnapshot>
  }
  youtube: {
    authStart(): Promise<{ authUrl: string }>
    authComplete(): Promise<YoutubeChannel[]>
    channels(): Promise<YoutubeChannel[]>
    upload(input: YoutubeVideoUpload): Promise<{ videoId: string }>
  }
  on: {
    progress(cb: (e: ProgressEvent) => void): () => void
    gameLog(cb: (e: GameLogEvent) => void): () => void
    gameExit(cb: (e: { instanceId: string; code: number | null }) => void): () => void
    instanceUpdate(cb: (e: Instance) => void): () => void
    socialUpdate(cb: (e: SocialPayload) => void): () => void
    accountUpdate(cb: (e: Account[]) => void): () => void
    youtubeUploadProgress(cb: (e: { percent: number }) => void): () => void
    bridgeUpdate(cb: (e: BridgeSnapshot) => void): () => void
    toast(cb: (e: ToastPayload) => void): () => void
  }
}
