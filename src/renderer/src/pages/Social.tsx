import { useState, type ReactNode } from 'react'
import { Copy, Crown, Link2, LogOut, UserPlus, Users, Wifi, WifiOff } from 'lucide-react'
import { Empty, Field, Modal } from '../components/ui'
import { errorMessage, toast, useApp } from '../store'

export default function Social(): ReactNode {
  const social = useApp((s) => s.social)
  const settings = useApp((s) => s.settings)
  const [friendName, setFriendName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = async (): Promise<void> => {
    try {
      const payload = await window.alpinoxi.social.partyState()
      useApp.setState({ social: payload })
    } catch {
      /* ignore */
    }
  }

  const connect = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.alpinoxi.social.connect()
      await refresh()
      toast('success', 'Sosyal sunucuya bağlanıldı')
    } catch (e) {
      toast('error', `Bağlanılamadı: ${errorMessage(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async (): Promise<void> => {
    await window.alpinoxi.social.disconnect()
    await refresh()
    toast('info', 'Bağlantı kesildi')
  }

  const addFriend = async (): Promise<void> => {
    if (!friendName.trim()) return
    try {
      const friends = await window.alpinoxi.social.addFriend(friendName.trim())
      useApp.setState({ social: { ...social, friends } })
      toast('success', `${friendName.trim()} eklendi`)
      setFriendName('')
    } catch (e) {
      toast('error', errorMessage(e))
    }
  }

  const removeFriend = async (id: string): Promise<void> => {
    const friends = await window.alpinoxi.social.removeFriend(id)
    useApp.setState({ social: { ...social, friends } })
  }

  const createParty = async (): Promise<void> => {
    try {
      const party = await window.alpinoxi.social.partyCreate()
      useApp.setState({ social: { ...social, party } })
      toast('success', `Parti kuruldu: ${party.code}`)
    } catch (e) {
      toast('error', errorMessage(e))
    }
  }

  const joinParty = async (): Promise<void> => {
    if (!joinCode.trim()) return
    try {
      const party = await window.alpinoxi.social.partyJoin(joinCode.trim())
      useApp.setState({ social: { ...social, party } })
      toast('success', 'Partiye katıldın')
      setJoinCode('')
    } catch (e) {
      toast('error', errorMessage(e))
    }
  }

  const leaveParty = async (): Promise<void> => {
    await window.alpinoxi.social.partyLeave()
    useApp.setState({ social: { ...social, party: null } })
    toast('info', 'Partiden ayrıldın')
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Arkadaşlar</h1>
          <p>Sosyal sunucu: {settings?.socialServerUrl ?? '—'}</p>
        </div>
        <div className="spacer" />
        {social.connected ? (
          <button className="btn danger" onClick={() => void disconnect()}>
            <WifiOff size={15} /> Bağlantıyı kes
          </button>
        ) : (
          <button className="btn primary" disabled={busy} onClick={() => void connect()}>
            <Wifi size={15} /> Bağlan
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 18, alignItems: 'start' }}>
        <div className="card pad">
          <div className="row" style={{ marginBottom: 12 }}>
            <Users size={16} />
            <strong style={{ fontSize: 14 }}>Arkadaş listesi</strong>
            <span className="badge">{social.friends.length}</span>
            <div className="grow" />
            <span className={`badge ${social.connected ? 'ok' : 'err'}`}>
              {social.connected ? 'çevrimiçi' : 'bağlı değil'}
            </span>
          </div>

          <div className="row" style={{ gap: 8, marginBottom: 14 }}>
            <input
              className="input"
              placeholder="Kullanıcı adı ekle…"
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void addFriend()}
            />
            <button className="btn" onClick={() => void addFriend()}>
              <UserPlus size={15} />
            </button>
          </div>

          {social.friends.length === 0 ? (
            <Empty icon={<Users size={22} />} title="Arkadaş yok" desc="Sosyal sunucuya bağlan ve arkadaş ekle." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {social.friends.map((f) => (
                <div key={f.id} className="friend">
                  <span className={`presence ${f.status}`} />
                  <span className="avatar">{f.username.slice(0, 1).toUpperCase()}</span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.3 }} className="ellipsis">
                      {f.username}
                    </div>
                    <div className="dim" style={{ fontSize: 11.5 }}>
                      {f.activity ?? f.status}
                    </div>
                  </div>
                  <button className="btn sm ghost icon" onClick={() => void removeFriend(f.id)}>
                    <LogOut size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="row">
            <Crown size={16} />
            <strong style={{ fontSize: 14 }}>Parti</strong>
          </div>

          {social.party ? (
            <>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="dim" style={{ fontSize: 12 }}>
                  Parti kodu
                </span>
                <button
                  className="btn sm ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(social.party!.code)
                    toast('success', 'Kod kopyalandı')
                  }}
                >
                  <Link2 size={13} /> {social.party.code}
                  <Copy size={12} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {social.party.members.map((m) => (
                  <div key={m.id} className="friend">
                    <span className="avatar">{m.username.slice(0, 1).toUpperCase()}</span>
                    <div className="grow">
                      <div style={{ fontWeight: 600, fontSize: 13.3 }}>{m.username}</div>
                      <div className="dim" style={{ fontSize: 11.5 }}>
                        {m.isHost ? 'kurucu' : m.ready ? 'hazır' : 'bekliyor'}
                      </div>
                    </div>
                    {m.isHost ? <Crown size={14} color="var(--warn)" /> : null}
                  </div>
                ))}
              </div>
              <button className="btn danger" onClick={() => void leaveParty()}>
                <LogOut size={15} /> Partiden ayrıl
              </button>
            </>
          ) : (
            <>
              <button className="btn primary" onClick={() => void createParty()}>
                <Crown size={15} /> Parti kur
              </button>
              <Field label="Parti kodu ile katıl">
                <div className="row" style={{ gap: 8 }}>
                  <input
                    className="input"
                    placeholder="ABC123"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  />
                  <button className="btn" onClick={() => void joinParty()}>
                    Katıl
                  </button>
                </div>
              </Field>
            </>
          )}
        </div>
      </div>

      <Modal open={false} title="" onClose={() => undefined}>
        <></>
      </Modal>
    </div>
  )
}