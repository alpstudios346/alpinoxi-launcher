import { useEffect, useState, type ReactNode } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar, { ToastStack } from './components/Sidebar'
import Splash from './components/Splash'
import { Bar } from './components/ui'
import { useApp } from './store'
import Home from './pages/Home'
import Instances from './pages/Instances'
import Modrinth from './pages/Modrinth'
import Cosmetics from './pages/Cosmetics'
import Social from './pages/Social'
import HudPage from './pages/Hud'
import YouTube from './pages/YouTube'
import Settings from './pages/Settings'

function CurrentPage(): ReactNode {
  const page = useApp((s) => s.page)
  switch (page) {
    case 'home':
      return <Home />
    case 'instances':
      return <Instances />
    case 'modrinth':
      return <Modrinth />
    case 'cosmetics':
      return <Cosmetics />
    case 'social':
      return <Social />
    case 'hud':
      return <HudPage />
    case 'youtube':
      return <YouTube />
    case 'settings':
      return <Settings />
    default:
      return <Home />
  }
}

export default function App(): ReactNode {
  const [splashDone, setSplashDone] = useState(false)
  const ready = useApp((s) => s.ready)
  const progress = useApp((s) => s.progress)

  useEffect(() => {
    void useApp.getState().refreshAll()
  }, [])

  useEffect(() => {
    const store = useApp.getState()
    const off = [
      window.alpinoxi.on.progress((e) => {
        store.setProgress(e.phase === 'done' || e.phase === 'error' ? null : e)
      }),
      window.alpinoxi.on.gameLog((e) => store.appendLog(e)),
      window.alpinoxi.on.gameExit((e) => {
        useApp.setState({ launching: false })
        store.setProgress(null)
        if (e.code === 0) store.pushToast({ type: 'success', message: 'Oyun kapandı. İyi oyunlar!' })
        else store.pushToast({ type: 'info', message: `Oyun ${e.code ?? 0} koduyla kapandı` })
        void store.refreshInstances()
      }),
      window.alpinoxi.on.instanceUpdate((e) => store.applyInstance(e)),
      window.alpinoxi.on.socialUpdate((e) => useApp.setState({ social: e })),
      window.alpinoxi.on.accountUpdate(() => void store.refreshAccounts()),
      window.alpinoxi.on.toast((e) => store.pushToast(e))
    ]
    return () => off.forEach((fn) => fn())
  }, [])

  if (!splashDone) return <Splash onDone={() => setSplashDone(true)} />

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <TitleBar hint={ready ? undefined : 'yükleniyor…'} />
        <div className="content">
          <CurrentPage />
        </div>
        {progress ? (
          <div className="dock">
            <span className="msg" style={{ minWidth: 180 }}>
              {progress.message}
            </span>
            <div className="grow">
              <Bar
                percent={
                  progress.percent ??
                  (progress.total ? ((progress.current ?? 0) / progress.total) * 100 : 30)
                }
              />
            </div>
          </div>
        ) : null}
      </div>
      <ToastStack />
    </div>
  )
}
