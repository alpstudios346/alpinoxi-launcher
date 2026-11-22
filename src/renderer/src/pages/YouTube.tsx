import { useEffect, useState, type ReactNode } from 'react'
import { Eye, LogIn, RefreshCw, SquarePlay, Upload, Users, Video } from 'lucide-react'
import { Empty, Field } from '../components/ui'
import { errorMessage, toast } from '../store'
import type { YoutubeChannel } from '@shared/types'

export default function YouTube(): ReactNode {
  const [channels, setChannels] = useState<YoutubeChannel[]>([])
  const [busy, setBusy] = useState(false)
  const [authUrl, setAuthUrl] = useState('')
  const [percent, setPercent] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [privacy, setPrivacy] = useState<'private' | 'unlisted' | 'public'>('private')

  useEffect(() => {
    window.alpinoxi.youtube
      .channels()
      .then(setChannels)
      .catch(() => setChannels([]))
    const off = window.alpinoxi.on.youtubeUploadProgress((e) => setPercent(e.percent))
    return () => off()
  }, [])

  const startAuth = async (): Promise<void> => {
    setBusy(true)
    try {
      const res = await window.alpinoxi.youtube.authStart()
      setAuthUrl(res.authUrl)
      void window.alpinoxi.app.openExternal(res.authUrl)
      toast('info', 'Tarayıcıda Google hesabınla giriş yap, sonra "Girişi tamamla"ya bas.')
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const completeAuth = async (): Promise<void> => {
    setBusy(true)
    try {
      const list = await window.alpinoxi.youtube.authComplete()
      setChannels(list)
      setAuthUrl('')
      toast('success', 'YouTube hesabı bağlandı')
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const upload = async (): Promise<void> => {
    if (!title.trim()) {
      toast('error', 'Başlık gerekli')
      return
    }
    setBusy(true)
    setPercent(0)
    try {
      const res = await window.alpinoxi.youtube.upload({
        filePath: '',
        title: title.trim(),
        description,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        privacyStatus: privacy
      })
      toast('success', `Video yüklendi: ${res.videoId}`)
      setTitle('')
      setDescription('')
      setTags('')
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setBusy(false)
      setPercent(null)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>YouTube</h1>
          <p>Kanalını yönet ve oynanış videolarını doğrudan yükle.</p>
        </div>
        <div className="spacer" />
        <span className="badge">{channels.length > 0 ? `${channels.length} kanal bağlı` : 'bağlı değil'}</span>
      </div>

      <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="row">
          <SquarePlay size={18} color="var(--err)" />
          <strong style={{ fontSize: 14 }}>Hesap</strong>
          <div className="grow" />
          {authUrl ? (
            <button className="btn primary" disabled={busy} onClick={() => void completeAuth()}>
              <RefreshCw size={15} /> Girişi tamamla
            </button>
          ) : (
            <button className="btn primary" disabled={busy} onClick={() => void startAuth()}>
              <LogIn size={15} /> Google ile bağlan
            </button>
          )}
        </div>

        {channels.length === 0 ? (
          <Empty icon={<SquarePlay size={24} />} title="Kanal bağlı değil" desc="Google hesabınla bağlanarak video yükle." />
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {channels.map((c) => (
              <div key={c.id} className="friend">
                <span className="avatar" style={{ width: 42, height: 42 }}>
                  {c.thumbnailUrl ? <img src={c.thumbnailUrl} alt="" /> : c.title.slice(0, 1).toUpperCase()}
                </span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 650, fontSize: 13.3 }} className="ellipsis">
                    {c.title}
                  </div>
                  <div className="row dim" style={{ fontSize: 11.3, gap: 10, marginTop: 3 }}>
                    <span>
                      <Users size={10} /> {c.subscriberCount}
                    </span>
                    <span>
                      <Video size={10} /> {c.videoCount}
                    </span>
                    <span>
                      <Eye size={10} /> {c.viewCount}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card pad" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="row">
          <Upload size={16} />
          <strong style={{ fontSize: 14 }}>Video yükle</strong>
        </div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Başlık">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Muhteşem bir oynanış" />
          </Field>
          <Field label="Gizlilik">
            <select className="select" value={privacy} onChange={(e) => setPrivacy(e.target.value as typeof privacy)}>
              <option value="private">Özel</option>
              <option value="unlisted">Listesiz</option>
              <option value="public">Herkese açık</option>
            </select>
          </Field>
        </div>
        <Field label="Etiketler (virgülle ayır)">
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="minecraft, alpinoxi, survival" />
        </Field>
        <Field label="Açıklama">
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {percent !== null ? (
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${percent}%` }} />
          </div>
        ) : null}
        <div className="row">
          <span className="dim" style={{ fontSize: 11.8 }}>
            Dosya seçimi yükleme sırasında açılır.
          </span>
          <div className="spacer grow" />
          <button className="btn primary" disabled={busy} onClick={() => void upload()}>
            <Upload size={15} /> {busy ? 'Yükleniyor…' : 'Yükle'}
          </button>
        </div>
      </div>
    </div>
  )
}
