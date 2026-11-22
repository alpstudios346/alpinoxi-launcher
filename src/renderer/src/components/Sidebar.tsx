import type { ReactNode } from 'react'
import {
  CircleCheckBig,
  CircleX,
  Gamepad2,
  Gauge,
  Home,
  Info,
  Layers,
  Palette,
  Settings,
  SquarePlay,
  Users
} from 'lucide-react'
import { useApp, type PageId } from '../store'

const NAV: { id: PageId; label: string; icon: ReactNode }[] = [
  { id: 'home', label: 'Ana Sayfa', icon: <Home size={17} /> },
  { id: 'instances', label: 'Kurulumlar', icon: <Layers size={17} /> },
  { id: 'modrinth', label: 'Modrinth', icon: <Gamepad2 size={17} /> },
  { id: 'cosmetics', label: 'Kozmetikler', icon: <Palette size={17} /> },
  { id: 'social', label: 'Arkadaşlar', icon: <Users size={17} /> },
  { id: 'hud', label: 'HUD', icon: <Gauge size={17} /> },
  { id: 'youtube', label: 'YouTube', icon: <SquarePlay size={17} /> },
  { id: 'settings', label: 'Ayarlar', icon: <Settings size={17} /> }
]

export default function Sidebar(): ReactNode {
  const page = useApp((s) => s.page)
  const setPage = useApp((s) => s.setPage)
  const appInfo = useApp((s) => s.appInfo)
  const social = useApp((s) => s.social)

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">A</div>
        <div>
          <div className="name">
            Alpinoxi <em>Client</em>
          </div>
          <div className="tag">Launcher</div>
        </div>
      </div>

      <nav className="nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`nav-item${page === item.id ? ' active' : ''}`}
            onClick={() => setPage(item.id)}
          >
            {item.icon}
            {item.label}
            {item.id === 'social' && social.connected ? <span className="dot" /> : null}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="row dim" style={{ fontSize: 11.5 }}>
          <Info size={13} />
          <span>sürüm {appInfo?.version ?? '—'}</span>
        </div>
      </div>
    </aside>
  )
}

export function ToastStack(): ReactNode {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  if (toasts.length === 0) return null
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => dismiss(t.id)}>
          {t.type === 'error' ? (
            <CircleX size={17} color="var(--err)" />
          ) : (
            <CircleCheckBig size={17} color={t.type === 'success' ? 'var(--ok)' : 'var(--accent-2)'} />
          )}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
