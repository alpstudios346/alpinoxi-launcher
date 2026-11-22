import { type ReactNode } from 'react'
import { FolderOpen, Info, KeyRound, Palette, RefreshCw, Trash } from 'lucide-react'
import { Field, Segmented, Toggle } from '../components/ui'
import { errorMessage, toast, useApp } from '../store'
import type { AppSettings } from '@shared/types'

export default function Settings(): ReactNode {
  const settings = useApp((s) => s.settings)
  const appInfo = useApp((s) => s.appInfo)
  const accounts = useApp((s) => s.accounts)
  const current = useApp((s) => s.currentAccount)

  const patch = async (p: Partial<AppSettings>): Promise<void> => {
    try {
      const next = await window.alpinoxi.settings.set(p)
      useApp.setState({ settings: next })
    } catch (e) {
      toast('error', errorMessage(e))
    }
  }

  if (!settings) {
    return (
      <div className="page-head">
        <h1>Ayarlar</h1>
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Ayarlar</h1>
          <p>Başlatıcı davranışı, giriş kimlikleri ve görünüm.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="row">
            <Palette size={16} />
            <strong style={{ fontSize: 14 }}>Görünüm</strong>
          </div>
          <Field label="Tema">
            <Segmented
              value={settings.theme}
              onChange={(v) => void patch({ theme: v })}
              options={[
                { value: 'midnight', label: 'Midnight' },
                { value: 'aurora', label: 'Aurora' },
                { value: 'ember', label: 'Ember' }
              ]}
            />
          </Field>
          <Field label="Dil">
            <select className="select" value={settings.language} onChange={(e) => void patch({ language: e.target.value as 'tr' | 'en' })}>
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </select>
          </Field>
          <div className="row" style={{ gap: 10 }}>
            <span style={{ fontSize: 12.5 }} className="grow">
              Vurgu rengi
            </span>
            <input
              type="color"
              value={settings.accentColor}
              onChange={(e) => void patch({ accentColor: e.target.value })}
              style={{ width: 44, height: 30, border: 'none', background: 'transparent', cursor: 'pointer' }}
            />
            <span className="mono dim">{settings.accentColor}</span>
          </div>
          <Toggle label="Hareketleri azalt" checked={settings.reduceMotion} onChange={(v) => void patch({ reduceMotion: v })} />
        </div>

        <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="row">
            <RefreshCw size={16} />
            <strong style={{ fontSize: 14 }}>Başlatıcı</strong>
          </div>
          <Toggle label="Kapatınca sistem tepsisinde kal" checked={settings.closeToTray} onChange={(v) => void patch({ closeToTray: v })} />
          <Toggle label="Discord Rich Presence" checked={settings.discordRpc} onChange={(v) => void patch({ discordRpc: v })} />
          <Toggle label="Anlık sürümleri (snapshot) göster" checked={settings.showSnapshots} onChange={(v) => void patch({ showSnapshots: v })} />
          <Toggle label="Otomatik güncelleme" checked={settings.autoUpdate} onChange={(v) => void patch({ autoUpdate: v })} />
          <Field label="Varsayılan bellek (MB)">
            <input
              className="input"
              type="number"
              defaultValue={settings.javaMemoryDefaultMb}
              onBlur={(e) => void patch({ javaMemoryDefaultMb: Number(e.target.value) || 4096 })}
            />
          </Field>
        </div>

        <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="row">
            <KeyRound size={16} />
            <strong style={{ fontSize: 14 }}>Giriş kimlikleri</strong>
          </div>
          <Field label="Microsoft (Azure) istemci kimliği">
            <input
              className="input"
              defaultValue={settings.microsoftClientId ?? ''}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              onBlur={(e) => void patch({ microsoftClientId: e.target.value })}
            />
          </Field>
          <Field label="YouTube istemci kimliği">
            <input
              className="input"
              defaultValue={settings.youtubeClientId ?? ''}
              onBlur={(e) => void patch({ youtubeClientId: e.target.value })}
            />
          </Field>
          <Field label="YouTube istemci gizli anahtarı">
            <input
              className="input"
              type="password"
              defaultValue={settings.youtubeClientSecret ?? ''}
              onBlur={(e) => void patch({ youtubeClientSecret: e.target.value })}
            />
          </Field>
          <Field label="Sosyal sunucu (WebSocket)">
            <input
              className="input"
              defaultValue={settings.socialServerUrl}
              onBlur={(e) => void patch({ socialServerUrl: e.target.value })}
            />
          </Field>
        </div>

        <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="row">
            <Info size={16} />
            <strong style={{ fontSize: 14 }}>Bilgi</strong>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12.5 }}>
            <div>
              <div className="dim">Sürüm</div>
              <div>{appInfo?.version ?? '—'}</div>
            </div>
            <div>
              <div className="dim">Platform</div>
              <div>
                {appInfo?.platform} · {appInfo?.arch}
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="dim">Veri klasörü</div>
              <div className="mono ellipsis">{appInfo?.dataDir ?? '—'}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm ghost" onClick={() => appInfo && void window.alpinoxi.app.openPath(appInfo.dataDir)}>
              <FolderOpen size={14} /> Veri klasörünü aç
            </button>
            <button className="btn sm ghost" onClick={() => appInfo && void window.alpinoxi.app.openPath(appInfo.instancesDir)}>
              <FolderOpen size={14} /> Kurulumlar
            </button>
            <button className="btn sm" onClick={() => void window.alpinoxi.app.relaunch()}>
              <RefreshCw size={14} /> Yeniden başlat
            </button>
          </div>
        </div>

        <div className="card pad" style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row">
            <strong style={{ fontSize: 14 }}>Hesaplar</strong>
            <span className="badge">{accounts.length}</span>
          </div>
          {accounts.length === 0 ? (
            <div className="muted" style={{ fontSize: 12.5 }}>
              Hesap yok. Ana sayfadan hesap ekleyebilirsin.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {accounts.map((a) => (
                <div key={a.id} className="friend">
                  <span className="avatar">{a.username.slice(0, 1).toUpperCase()}</span>
                  <div className="grow">
                    <div style={{ fontWeight: 600, fontSize: 13.3 }}>
                      {a.username} {a.id === current?.id ? <span className="badge ok">aktif</span> : null}
                    </div>
                    <div className="dim mono" style={{ fontSize: 11 }}>
                      {a.type} · {a.uuid}
                    </div>
                  </div>
                  <button
                    className="btn sm ghost icon"
                    onClick={() =>
                      void window.alpinoxi.auth.remove(a.id).then(() => {
                        void useApp.getState().refreshAccounts()
                        toast('info', 'Hesap kaldırıldı')
                      })
                    }
                  >
                    <Trash size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
