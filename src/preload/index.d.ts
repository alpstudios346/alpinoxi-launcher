import type { AlpinoxiApi } from '@shared/ipc'

declare global {
  interface Window {
    alpinoxi: AlpinoxiApi
  }
}

export {}
