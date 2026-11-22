import { useState, type ReactNode } from 'react'
import {
  Clock,
  Gamepad2,
  Layers,
  Palette,
  Play,
  Plus,
  Settings as SettingsIcon,
  Square,
  Users,
  Gauge,
  Sparkles
} from 'lucide-react'
import AccountBar from '../components/AccountBar'
import { Empty, Stat } from '../components/ui'
import { errorMessage, toast, useApp, type PageId } from '../store'

function formatPlaytime(ms: number): string {
  const hours = Math.floor(ms / 3_600_000)
  if (hours <= 0) return `${Math.floor(ms / 60_000)}dk`
  return `${hours}s ${Math.floor((ms % 3_600_000) / 60_000)}dk`
}

const QUICK: { id: PageId; label: string; desc: string; icon: ReactNode }[] = [
  { id: 'modrinth', label: 'Modrinth', desc: 'Mod, modpack, shader indir', icon: <Gamepad2 size={20} /> },
  { id: 'cosmetics', label: 'Kozmetikler', desc: 'Cape, kanat, skin yükle', icon: <Palette size={20} /> },
  { id: 'social', label: 'Arkadaşlar', desc: 'Parti kur, birlikte oyna', icon: <Users size={20} /> },
  { id: 'hud', label: 'HUD', desc: 'Oyun içi gösterge paneli', icon: <Gauge size={20} /> }
]

export default function Home(): ReactNode {
  const instances = useApp((s) => s.instances)
  const selectedId = useApp((s) => s.selectedInstanceId)
  const setPage = useApp((s) => s.setPage)
  const launching = useApp((s) => s.launching)
  const currentAccount = useApp((s) => s.currentAccount)
  const accounts = useApp((s) => s.accounts)
  const [busy, setBusy] = useState(false)

  const selected = instances.find((i) => i.id === selectedId) ?? instances[0] ?? null
  const totalPlaytime = instances.reduce((sum, i) => sum + (i.playtimeMs ?? 0), 0)

  const launch = async (): Promise<void> => {
    if (!selected) return
    if (!currentAccount) {
      toast('error', 'Önce bir hesap ekle')
      return
    }
    setBusy(true)
    try {
      await window.alpinoxi.launch.start(selected.id)
      useApp.setState({ launching: true, progress: null })
      toast('success', `${selected.name} başlatıldı`)
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const stop = async (): Promise<void> => {
    if (!selected) return
    await window.alpinoxi.launch.stop(selected.id)
    useApp.setState({ launching: false })
    toast('info', 'Durdurma isteği gönderildi')
  }

  const loaderLabel: Record<string, string> = {
    vanilla: 'Vanilla',
    fabric: 'Fabric',
    quilt: 'Quilt',
    forge: 'Forge',
    neoforge: 'NeoForge',
    optifine: 'OptiFine',
    alpinoxi: 'Alpinoxi Client'
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Ana Sayfa</h1>
          <p>Oynamaya hazır mısın? Kurulumunu seç ve başlat.</p>
        </div>
        <div className="spacer" />
        <AccountBar />
      </div>

      {selected ? (
        <div className="hero fade-enter">
          <div className="orb" />
          <div className="row" style={{ gap: 8 }}>
            <span className="badge ok">
              <Sparkles size={12} /> {loaderLabel[selected.loader] ?? selected.loader}
            </span>
            <span className="badge">{selected.mcVersion}</span>
            {selected.clientEnabled ? <span className="badge warn">Client modu</span> : <span className="badge">Vanilla</span>}
          </div>
          <h2 style={{ marginTop: 12 }}>{selected.name}</h2>
          <div className="sub">
            {selected.clientEnabled
              ? 'Alpinoxi Client mod paketi uygulandı — Sodium, Lithium, Iris ve daha fazlası ile maksimum performans.'
              : 'Temiz kurulum. İstediğin modu Modrinth üzerinden ekleyebilirsin.'}
          </div>
          <div className="actions">
            {launching ? (
              <button className="btn big danger" onClick={() => void stop()}>
                <Square size={17} /> Durdur
              </button>
            ) : (
              <button className="btn big primary" disabled={busy} onClick={() => void launch()}>
                <Play size={17} /> Oyna
              </button>
            )}
            <button className="btn big ghost" onClick={() => setPage('instances')}>
              <SettingsIcon size={17} /> Kurulumu düzenle
            </button>
            <span className="dim" style={{ fontSize: 12 }}>
              {currentAccount ? `${currentAccount.username} olarak` : 'giriş yapılmadı'}
            </span>
          </div>
        </div>
      ) : (
        <div className="card pad">
          <Empty
            icon={<Layers size={26} />}
            title="Henüz kurulum yok"
            desc="Bir Minecraft sürümü ve loader seçerek ilk kurulumunu oluştur."
            action={
              <button className="btn primary" onClick={() => setPage('instances')} style={{ marginTop: 6 }}>
                <Plus size={15} /> Kurulum oluştur
              </button>
            }
          />
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 18 }}>
        <Stat label="Kurulum" value={instances.length} />
        <Stat label="Toplam Oynama" value={formatPlaytime(totalPlaytime)} />
        <Stat label="Hesap" value={accounts.length} />
        <Stat label="Loader Desteği" value="7" />
      </div>

      <div className="page-head" style={{ paddingTop: 26, paddingBottom: 14 }}>
        <h1 style={{ fontSize: 18 }}>Hızlı Erişim</h1>
        <div className="spacer" />
        <Clock size={15} className="dim" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {QUICK.map((q) => (
          <button
            key={q.id}
            className="card pad"
            style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}
            onClick={() => setPage(q.id)}
          >
            <span
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                color: '#0a0a12'
              }}
            >
              {q.icon}
            </span>
            <div style={{ fontWeight: 650 }}>{q.label}</div>
            <div className="muted" style={{ fontSize: 12.3 }}>
              {q.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
