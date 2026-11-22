import { useState, type ReactNode } from 'react'
import { Gauge, Monitor, Palette } from 'lucide-react'
import { Segmented, Toggle } from '../components/ui'
import { errorMessage, toast, useApp } from '../store'
import type { HudConfig } from '@shared/types'

type HudFlag = {
  key: keyof HudConfig
  label: string
}

const ELEMENTS: HudFlag[] = [
  { key: 'fps', label: 'FPS sayacı' },
  { key: 'coordinates', label: 'Koordinatlar (XYZ)' },
  { key: 'biome', label: 'Biyom' },
  { key: 'ping', label: 'Ping' },
  { key: 'memory', label: 'Bellek kullanımı' },
  { key: 'keyStrokes', label: 'Tuş vuruşları (WASD)' },
  { key: 'cps', label: 'CPS' },
  { key: 'armor', label: 'Zırh durumu' },
  { key: 'potionEffects', label: 'İksir etkileri' },
  { key: 'session', label: 'Oturum süresi' }
]

export default function HudPage(): ReactNode {
  const hud = useApp((s) => s.hud)
  const [saving, setSaving] = useState(false)

  const patch = async (p: Partial<HudConfig>): Promise<void> => {
    setSaving(true)
    try {
      const next = await window.alpinoxi.hud.set(p)
      useApp.setState({ hud: next })
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (!hud) {
    return (
      <div className="page-head">
        <h1>HUD</h1>
      </div>
    )
  }

  const color = hud.accentColor || '#7C5CFF'

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>HUD</h1>
          <p>Oyun içi gösterge paneli. Anlık önizleme ile sağdan sola yerleşimi ayarla.</p>
        </div>
        <div className="spacer" />
        <span className={`badge ${hud.enabled ? 'ok' : ''}`}>{hud.enabled ? 'aktif' : 'kapalı'}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row">
            <Gauge size={16} />
            <strong style={{ fontSize: 14 }}>Öğeler</strong>
          </div>
          <Toggle label="HUD etkin" checked={hud.enabled} onChange={(v) => void patch({ enabled: v })} />
          {ELEMENTS.map((el) => (
            <Toggle
              key={el.key}
              label={el.label}
              checked={Boolean(hud[el.key])}
              onChange={(v) => void patch({ [el.key]: v } as Partial<HudConfig>)}
            />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="row">
              <Monitor size={16} />
              <strong style={{ fontSize: 14 }}>Yerleşim</strong>
            </div>
            <Segmented
              value={hud.position}
              onChange={(v) => void patch({ position: v })}
              options={[
                { value: 'top-left', label: 'Sol Üst' },
                { value: 'top-right', label: 'Sağ Üst' },
                { value: 'bottom-left', label: 'Sol Alt' },
                { value: 'bottom-right', label: 'Sağ Alt' }
              ]}
            />
            <div className="field">
              <label>Ölçek: {hud.scale.toFixed(1)}x</label>
              <input
                type="range"
                min={0.6}
                max={1.8}
                step={0.1}
                value={hud.scale}
                onChange={(e) => void patch({ scale: Number(e.target.value) })}
              />
            </div>
            <div className="row" style={{ gap: 10 }}>
              <Palette size={15} className="dim" />
              <span style={{ fontSize: 12.5 }}>Vurgu rengi</span>
              <input
                type="color"
                value={color}
                onChange={(e) => void patch({ accentColor: e.target.value })}
                style={{ width: 44, height: 30, border: 'none', background: 'transparent', cursor: 'pointer' }}
              />
              <span className="mono dim">{color}</span>
            </div>
          </div>

          <div className="card pad">
            <div className="row" style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: 13.5 }}>Önizleme</strong>
              <span className="dim" style={{ fontSize: 11.5 }}>
                {saving ? 'kaydediliyor…' : 'gerçek zamanlı'}
              </span>
            </div>
            <div className="hud-preview">
              {hud.enabled ? (
                <div
                  className={`hud-layer ${hud.position === 'top-left' ? 'tl' : hud.position === 'top-right' ? 'tr' : hud.position === 'bottom-left' ? 'bl' : 'br'}`}
                  style={{ transform: `scale(${hud.scale})`, transformOrigin: hud.position.includes('left') ? 'left top' : 'right top' }}
                >
                  {hud.fps ? <span style={{ color }}>144 FPS</span> : null}
                  {hud.coordinates ? <span>XYZ: 128 / 64 / -342</span> : null}
                  {hud.biome ? <span>Biyom: Plains</span> : null}
                  {hud.ping ? <span>Ping: 24ms</span> : null}
                  {hud.memory ? <span>RAM: 2048 / 4096 MB</span> : null}
                  {hud.keyStrokes ? <span>[W][A][S][D]  [SPACE]</span> : null}
                  {hud.cps ? <span>CPS: 7</span> : null}
                  {hud.armor ? <span>Zırh: ⛨⛨⛨⛨</span> : null}
                  {hud.potionEffects ? <span>Hız II · Gece Görüşü</span> : null}
                  {hud.session ? <span>Süre: 00:42:17</span> : null}
                </div>
              ) : (
                <div className="muted" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff' }}>
                  HUD kapalı
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
