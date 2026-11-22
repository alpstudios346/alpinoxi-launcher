import { app, BrowserWindow, net, protocol, shell } from 'electron'
import { join, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { dirs, ensureDirs, setDataRoot } from './core/paths'
import { getSettings } from './core/settings'
import { registerIpc, setWindow } from './ipc'

const rendererUrl = process.env.ELECTRON_RENDERER_URL

// `alpinoxi://` is used to serve uploaded skins/capes to the renderer.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'alpinoxi',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true }
  }
])

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null

function applyDataRoot(): void {
  ensureDirs()
  const settings = getSettings()
  if (settings.dataDir && settings.dataDir !== dirs.root) setDataRoot(settings.dataDir)
}

function registerProtocolHandler(): void {
  protocol.handle('alpinoxi', async (request) => {
    const url = new URL(request.url)
    const host = url.hostname
    const file = basename(decodeURIComponent(url.pathname))
    if (!file) return new Response('Not found', { status: 404 })
    const base = host === 'skin' ? dirs.skins : join(dirs.cosmetics, 'uploads')
    const target = join(base, file)
    if (!target.startsWith(base)) return new Response('Forbidden', { status: 403 })
    return net.fetch(pathToFileURL(target).toString())
  })
}

function createSplash(): void {
  splashWindow = new BrowserWindow({
    width: 440,
    height: 300,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    skipTaskbar: true,
    show: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  })

  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: transparent; overflow: hidden;
    font-family: 'Segoe UI', system-ui, sans-serif; -webkit-app-region: drag; }
  .card { width: 100%; height: 100%; border-radius: 22px; overflow: hidden;
    background: radial-gradient(120% 140% at 20% 0%, #2a1a5e 0%, #120c28 45%, #07060f 100%);
    border: 1px solid rgba(124, 92, 255, .35);
    box-shadow: 0 30px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
    position: relative; }
  .glow { position: absolute; inset: -60px; background:
    radial-gradient(circle at 50% 30%, rgba(124,92,255,.45), transparent 60%); filter: blur(30px); }
  .mark { width: 84px; height: 84px; border-radius: 24px; position: relative; z-index: 2;
    background: linear-gradient(135deg, #7C5CFF, #22d3ee);
    display: grid; place-items: center; font-size: 40px; font-weight: 800; color: #0a0a12;
    box-shadow: 0 12px 40px rgba(124,92,255,.5); animation: pop .9s cubic-bezier(.2,.9,.2,1); }
  h1 { position: relative; z-index: 2; color: #fff; font-size: 22px; letter-spacing: .5px; }
  h1 span { background: linear-gradient(90deg,#7C5CFF,#22d3ee); -webkit-background-clip: text; color: transparent; }
  p { position: relative; z-index: 2; color: rgba(255,255,255,.55); font-size: 12.5px; }
  .bar { position: relative; z-index: 2; width: 200px; height: 4px; border-radius: 99px;
    background: rgba(255,255,255,.12); overflow: hidden; }
  .bar i { display: block; width: 40%; height: 100%; border-radius: 99px;
    background: linear-gradient(90deg,#7C5CFF,#22d3ee); animation: slide 1.1s ease-in-out infinite; }
  @keyframes slide { 0% { transform: translateX(-100%);} 100% { transform: translateX(350%);} }
  @keyframes pop { 0% { transform: scale(.6); opacity: 0;} 100% { transform: scale(1); opacity: 1;} }
</style></head><body>
  <div class="card">
    <div class="glow"></div>
    <div class="mark">A</div>
    <h1>Alpinoxi <span>Client</span></h1>
    <div class="bar"><i></i></div>
    <p>Yükleniyor… en iyi performans hazırlanıyor</p>
  </div>
</body></html>`

  void splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 850,
    minWidth: 1060,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor: '#07060f',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  setWindow(mainWindow)

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    applyDataRoot()
    registerProtocolHandler()
    registerIpc()
    createSplash()
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
