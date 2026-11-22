import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Globe, KeyRound, LogIn, Plus, RefreshCw, UserPlus } from 'lucide-react'
import { Modal, Field } from './ui'
import { errorMessage, toast, useApp } from '../store'

type Mode = 'offline' | 'microsoft' | 'elyby' | null

export default function AccountBar(): ReactNode {
  const accounts = useApp((s) => s.accounts)
  const current = useApp((s) => s.currentAccount)
  const refreshAccounts = useApp((s) => s.refreshAccounts)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [device, setDevice] = useState<{ userCode: string; verificationUri: string; deviceCode: string } | null>(null)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [])

  const switchTo = async (id: string): Promise<void> => {
    await window.alpinoxi.auth.setCurrent(id)
    await refreshAccounts()
    setOpen(false)
  }

  const addOffline = async (): Promise<void> => {
    if (!username.trim()) return
    setBusy(true)
    try {
      await window.alpinoxi.auth.offline(username.trim())
      await refreshAccounts()
      toast('success', `${username.trim()} olarak giriş yapıldı`)
      setMode(null)
      setUsername('')
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const startMicrosoft = async (): Promise<void> => {
    setBusy(true)
    try {
      const res = await window.alpinoxi.auth.microsoftStart()
      setDevice({ userCode: res.userCode, verificationUri: res.verificationUri, deviceCode: res.deviceCode })
      void window.alpinoxi.app.openExternal(res.verificationUri)
      if (pollRef.current) window.clearInterval(pollRef.current)
      pollRef.current = window.setInterval(async () => {
        try {
          const account = await window.alpinoxi.auth.microsoftPoll(res.deviceCode)
          if (account) {
            if (pollRef.current) window.clearInterval(pollRef.current)
            await refreshAccounts()
            toast('success', `${account.username} olarak giriş yapıldı`)
            setMode(null)
            setDevice(null)
          }
        } catch (e) {
          if (pollRef.current) window.clearInterval(pollRef.current)
          toast('error', errorMessage(e))
        }
      }, Math.max(4, res.interval) * 1000)
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const startElyby = async (): Promise<void> => {
    try {
      await window.alpinoxi.auth.elybyStart()
      toast('info', 'ely.by girişi açıldı. Giriş yaptıktan sonra "Oturumu Tamamla"ya bas.')
    } catch (e) {
      toast('error', errorMessage(e))
    }
  }

  const completeElyby = async (): Promise<void> => {
    setBusy(true)
    try {
      const account = await window.alpinoxi.auth.elybyComplete()
      if (account) {
        await refreshAccounts()
        toast('success', `${account.username} (ely.by) giriş yapıldı`)
        setMode(null)
      }
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const initials = (current?.username ?? '?').slice(0, 1).toUpperCase()
  const typeLabel = current?.type === 'microsoft' ? 'Microsoft' : current?.type === 'elyby' ? 'ely.by' : 'Offline'

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn ghost" onClick={() => setOpen((v) => !v)}>
        <span className="avatar" style={{ width: 24, height: 24, borderRadius: 8, fontSize: 11 }}>
          {current?.skinUrl ? <img src={current.skinUrl} alt="" /> : initials}
        </span>
        <span className="ellipsis" style={{ maxWidth: 130 }}>
          {current?.username ?? 'Hesap ekle'}
        </span>
        <ChevronDown size={14} />
      </button>

      {open ? (
        <div
          className="card pad"
          style={{ position: 'absolute', right: 0, top: 46, width: 288, zIndex: 40, padding: 12 }}
        >
          <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 8, letterSpacing: 0.6 }}>
            HESAPLAR
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {accounts.length === 0 ? (
              <div className="muted" style={{ fontSize: 12.5, padding: '6px 4px' }}>
                Henüz hesap yok.
              </div>
            ) : (
              accounts.map((a) => (
                <button
                  key={a.id}
                  className={`nav-item${a.id === current?.id ? ' active' : ''}`}
                  onClick={() => void switchTo(a.id)}
                >
                  <span className="avatar" style={{ width: 26, height: 26, borderRadius: 8, fontSize: 12 }}>
                    {a.username.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="grow ellipsis" style={{ textAlign: 'left' }}>
                    {a.username}
                    <div className="dim" style={{ fontSize: 10.5 }}>
                      {a.type === 'microsoft' ? 'Microsoft' : a.type === 'elyby' ? 'ely.by' : 'Offline'}
                    </div>
                  </span>
                </button>
              ))
            )}
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm ghost grow" onClick={() => { setMode('offline'); setOpen(false) }}>
              <UserPlus size={14} /> Offline
            </button>
            <button className="btn sm ghost grow" onClick={() => { setMode('microsoft'); setOpen(false) }}>
              <LogIn size={14} /> Microsoft
            </button>
          </div>
          <button
            className="btn sm ghost"
            style={{ width: '100%', marginTop: 6 }}
            onClick={() => { setMode('elyby'); setOpen(false) }}
          >
            <Globe size={14} /> ely.by ile giriş
          </button>
          <div className="row dim" style={{ fontSize: 11, marginTop: 10, gap: 6 }}>
            <KeyRound size={12} /> {current ? `Aktif: ${current.username} · ${typeLabel}` : 'Hesap seçilmedi'}
          </div>
        </div>
      ) : null}

      <Modal
        open={mode === 'offline'}
        title="Offline hesap"
        desc="Sunucu doğrulaması gerektirmeyen yerel hesap. Yeel skin desteklenir."
        onClose={() => setMode(null)}
      >
        <div className="grid">
          <Field label="Kullanıcı adı">
            <input
              className="input"
              value={username}
              autoFocus
              placeholder="SteveTR"
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void addOffline()}
            />
          </Field>
          <button className="btn primary" disabled={busy || !username.trim()} onClick={() => void addOffline()}>
            <Plus size={15} /> Hesap oluştur
          </button>
        </div>
      </Modal>

      <Modal
        open={mode === 'microsoft'}
        title="Microsoft ile giriş"
        desc="Ayarlar > Hesap bölümünde Azure istemci kimliği girilmiş olmalı."
        onClose={() => {
          if (pollRef.current) window.clearInterval(pollRef.current)
          setMode(null)
          setDevice(null)
        }}
      >
        {device ? (
          <div className="grid">
            <div className="card pad" style={{ textAlign: 'center' }}>
              <div className="dim" style={{ fontSize: 11.5, letterSpacing: 0.6 }}>
                TARAYICIDA ŞU KODU GİR
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, margin: '10px 0' }}>
                {device.userCode}
              </div>
              <button className="btn ghost sm" onClick={() => void window.alpinoxi.app.openExternal(device.verificationUri)}>
                <Globe size={14} /> {device.verificationUri}
              </button>
            </div>
            <div className="row muted" style={{ fontSize: 12.5, justifyContent: 'center' }}>
              <RefreshCw size={14} className="spin" /> Onay bekleniyor…
            </div>
          </div>
        ) : (
          <button className="btn primary" disabled={busy} onClick={() => void startMicrosoft()}>
            <LogIn size={15} /> Girişi başlat
          </button>
        )}
      </Modal>

      <Modal
        open={mode === 'elyby'}
        title="ely.by ile giriş"
        desc="Gerçek tarayıcı penceresi açılır (iframe yok). Kendi hesabınla giriş yap."
        onClose={() => setMode(null)}
      >
        <div className="grid">
          <button className="btn primary" onClick={() => void startElyby()}>
            <Globe size={15} /> ely.by penceresini aç
          </button>
          <button className="btn" disabled={busy} onClick={() => void completeElyby()}>
            <RefreshCw size={15} /> Oturumu tamamla
          </button>
        </div>
      </Modal>
    </div>
  )
}
