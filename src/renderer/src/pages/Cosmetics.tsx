import { useState, type ReactNode } from 'react'
import { Check, Globe, Image as ImageIcon, Palette, Sparkles, Upload, WandSparkles } from 'lucide-react'
import { Empty } from '../components/ui'
import { errorMessage, toast, useApp } from '../store'
import type { CosmeticItem } from '@shared/types'

const CATEGORIES: { id: CosmeticItem['category'] | 'all'; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'cape', label: 'Cape' },
  { id: 'wings', label: 'Kanat' },
  { id: 'hat', label: 'Şapka' },
  { id: 'bandana', label: 'Bandana' },
  { id: 'boots', label: 'Bot' },
  { id: 'back', label: 'Sırt' },
  { id: 'emote', label: 'Emote' }
]

export default function Cosmetics(): ReactNode {
  const cosmetics = useApp((s) => s.cosmetics)
  const equipped = useApp((s) => s.equipped)
  const current = useApp((s) => s.currentAccount)
  const refreshCosmetics = useApp((s) => s.refreshCosmetics)
  const [category, setCategory] = useState<CosmeticItem['category'] | 'all'>('all')
  const [busy, setBusy] = useState(false)

  const filtered = category === 'all' ? cosmetics : cosmetics.filter((c) => c.category === category)

  const toggle = async (item: CosmeticItem): Promise<void> => {
    const active = equipped[item.category] === item.id
    try {
      await window.alpinoxi.cosmetics.equip(item.category, active ? undefined : item.id)
      await refreshCosmetics()
    } catch (e) {
      toast('error', errorMessage(e))
    }
  }

  const runUpload = async (kind: 'skin' | 'cape' | 'animated'): Promise<void> => {
    setBusy(true)
    try {
      if (kind === 'skin') {
        const res = await window.alpinoxi.cosmetics.uploadSkin('')
        if (res) toast('success', 'Skin yüklendi')
      } else if (kind === 'cape') {
        const res = await window.alpinoxi.cosmetics.uploadCape('')
        if (res) toast('success', res.animated ? 'Animasyonlu cape yüklendi' : 'Cape yüklendi')
      } else {
        const res = await window.alpinoxi.cosmetics.animated('')
        if (res) toast('success', `Animated doku işlendi (${res.frames} kare)`)
      }
      await refreshCosmetics()
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const accountNote =
    current?.type === 'microsoft'
      ? 'Microsoft modu: tüm kozmetikler bedava + skin changer aktif.'
      : current?.type === 'elyby'
        ? 'ely.by modu: kozmetikleri ely.by tarayıcı penceresinden yönet.'
        : current
          ? 'Offline mod: yeel skin desteği aktif. PNG yükleyebilirsin.'
          : 'Giriş yapılmadı — hesap ekleyerek kozmetikleri aç.'

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Kozmetikler</h1>
          <p>{accountNote}</p>
        </div>
        <div className="spacer" />
        <button className="btn ghost" onClick={() => void window.alpinoxi.cosmetics.openElyby()}>
          <Globe size={15} /> ely.by ile yönet
        </button>
      </div>

      <div className="card pad" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn" disabled={busy} onClick={() => void runUpload('skin')}>
          <ImageIcon size={15} /> PNG skin yükle
        </button>
        <button className="btn" disabled={busy} onClick={() => void runUpload('cape')}>
          <Upload size={15} /> PNG cape / animated cape
        </button>
        <button className="btn" disabled={busy} onClick={() => void runUpload('animated')}>
          <WandSparkles size={15} /> Animated doku işle
        </button>
        <div className="spacer grow" />
        <div className="seg">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={c.id === category ? 'active' : ''} onClick={() => setCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {filtered.length === 0 ? (
          <div className="card pad">
            <Empty icon={<Palette size={24} />} title="Kozmetik yok" desc="PNG yükleyerek veya ely.by ile yeni kozmetik ekle." />
          </div>
        ) : (
          <div className="cos-grid">
            {filtered.map((item) => {
              const active = equipped[item.category] === item.id
              return (
                <div key={item.id} className={`cos${active ? ' equipped' : ''}`} onClick={() => void toggle(item)}>
                  {item.animated ? (
                    <span className="tagline">
                      <Sparkles size={10} /> animated
                    </span>
                  ) : null}
                  {active ? (
                    <span className="tagline" style={{ left: 'auto', right: 8, borderColor: 'var(--accent-2)', color: 'var(--accent-2)' }}>
                      <Check size={10} /> takılı
                    </span>
                  ) : null}
                  <img className="thumb" src={item.textureUrl} alt={item.name} loading="lazy" />
                  <div className="info">
                    <div className="n ellipsis">{item.name}</div>
                    <div className="dim" style={{ fontSize: 10.5, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      {item.category}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
