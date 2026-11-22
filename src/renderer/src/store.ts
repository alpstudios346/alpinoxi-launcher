import { create } from 'zustand'
import type {
  Account,
  AppInfo,
  AppSettings,
  CosmeticItem,
  EquippedCosmetics,
  GameLogEvent,
  HudConfig,
  Instance,
  MinecraftVersion,
  ProgressEvent
} from '@shared/types'
import type { SocialPayload, ToastPayload } from '@shared/ipc'

export type PageId =
  | 'home'
  | 'instances'
  | 'modrinth'
  | 'cosmetics'
  | 'social'
  | 'hud'
  | 'youtube'
  | 'settings'

export interface ToastItem extends ToastPayload {
  id: number
}

interface AppState {
  ready: boolean
  page: PageId
  appInfo: AppInfo | null
  settings: AppSettings | null
  accounts: Account[]
  currentAccount: Account | null
  instances: Instance[]
  selectedInstanceId: string | null
  versions: MinecraftVersion[]
  cosmetics: CosmeticItem[]
  equipped: EquippedCosmetics
  hud: HudConfig | null
  social: SocialPayload
  toasts: ToastItem[]
  progress: ProgressEvent | null
  launching: boolean
  logs: GameLogEvent[]

  setPage: (page: PageId) => void
  setReady: (ready: boolean) => void
  selectInstance: (id: string | null) => void
  pushToast: (toast: ToastPayload) => void
  dismissToast: (id: number) => void
  refreshAll: () => Promise<void>
  refreshInstances: () => Promise<void>
  refreshAccounts: () => Promise<void>
  refreshCosmetics: () => Promise<void>
  applyInstance: (instance: Instance) => void
  setProgress: (progress: ProgressEvent | null) => void
  appendLog: (entry: GameLogEvent) => void
}

const emptySocial: SocialPayload = { friends: [], party: null, connected: false }

let toastSeq = 1

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  page: 'home',
  appInfo: null,
  settings: null,
  accounts: [],
  currentAccount: null,
  instances: [],
  selectedInstanceId: null,
  versions: [],
  cosmetics: [],
  equipped: {},
  hud: null,
  social: emptySocial,
  toasts: [],
  progress: null,
  launching: false,
  logs: [],

  setPage: (page) => set({ page }),
  setReady: (ready) => set({ ready }),
  selectInstance: (id) => set({ selectedInstanceId: id }),

  pushToast: (toast) => {
    const id = toastSeq++
    set({ toasts: [...get().toasts, { ...toast, id }] })
    window.setTimeout(() => get().dismissToast(id), toast.type === 'error' ? 7000 : 4200)
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  setProgress: (progress) => set({ progress }),

  appendLog: (entry) => {
    const logs = [...get().logs, entry]
    set({ logs: logs.slice(-600) })
  },

  refreshInstances: async () => {
    const instances = await window.alpinoxi.instances.list()
    const selected = get().selectedInstanceId
    set({
      instances,
      selectedInstanceId: selected && instances.some((i) => i.id === selected) ? selected : instances[0]?.id ?? null
    })
  },

  refreshAccounts: async () => {
    const [accounts, currentAccount] = await Promise.all([
      window.alpinoxi.auth.list(),
      window.alpinoxi.auth.current()
    ])
    set({ accounts, currentAccount })
  },

  refreshCosmetics: async () => {
    const [cosmetics, equipped] = await Promise.all([
      window.alpinoxi.cosmetics.list(),
      window.alpinoxi.cosmetics.equipped()
    ])
    set({ cosmetics, equipped })
  },

  applyInstance: (instance) =>
    set({ instances: get().instances.map((i) => (i.id === instance.id ? instance : i)) }),

  refreshAll: async () => {
    const results = await Promise.allSettled([
      window.alpinoxi.app.info(),
      window.alpinoxi.settings.get(),
      window.alpinoxi.instances.list(),
      window.alpinoxi.auth.list(),
      window.alpinoxi.auth.current(),
      window.alpinoxi.cosmetics.list(),
      window.alpinoxi.cosmetics.equipped(),
      window.alpinoxi.hud.get(),
      window.alpinoxi.versions.list(),
      window.alpinoxi.social.partyState()
    ])

    const value = <T,>(index: number, fallback: T): T =>
      results[index].status === 'fulfilled' ? (results[index].value as T) : fallback

    const instances = value<Instance[]>(2, [])
    set({
      appInfo: value<AppInfo | null>(0, null),
      settings: value<AppSettings | null>(1, null),
      instances,
      selectedInstanceId: get().selectedInstanceId ?? instances[0]?.id ?? null,
      accounts: value<Account[]>(3, []),
      currentAccount: value<Account | null>(4, null),
      cosmetics: value<CosmeticItem[]>(5, []),
      equipped: value<EquippedCosmetics>(6, {}),
      hud: value<HudConfig | null>(7, null),
      versions: value<MinecraftVersion[]>(8, []),
      social: value<SocialPayload>(9, emptySocial),
      ready: true
    })
  }
}))

/** Imperative toast helper usable outside React components. */
export function toast(type: ToastPayload['type'], message: string): void {
  useApp.getState().pushToast({ type, message })
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Beklenmeyen bir hata oluştu'
}
