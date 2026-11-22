import { useEffect, useState, type ReactNode } from 'react'
import {
  Copy,
  Cpu,
  Download,
  FolderOpen,
  Layers,
  Package,
  PackagePlus,
  Play,
  Plus,
  RefreshCw,
  Trash,
  Upload
} from 'lucide-react'
import { Empty, Field, LoaderBadge, Modal, Toggle } from '../components/ui'
import { errorMessage, toast, useApp } from '../store'
import type { Instance, LoaderBuild, LoaderType } from '@shared/types'

const LOADERS: { value: LoaderType; label: string }[] = [
  { value: 'alpinoxi', label: 'Alpinoxi Client (Fabric tabanlı)' },
  { value: 'vanilla', label: 'Vanilla (modsuz)' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'quilt', label: 'Quilt' },
  { value: 'forge', label: 'Forge' },
  { value: 'neoforge', label: 'NeoForge' },
  { value: 'optifine', label: 'OptiFine' }
]

export default function Instances(): ReactNode {
  const instances = useApp((s) => s.instances)
  const versions = useApp((s) => s.versions)
  const selectedId = useApp((s) => s.selectedInstanceId)
  const selectInstance = useApp((s) => s.selectInstance)
  const refreshInstances = useApp((s) => s.refreshInstances)

  const [createOpen, setCreateOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mods, setMods] = useState<string[]>([])
  const [modsLoading, setModsLoading] = useState(false)

  const [name, setName] = useState('Alpinoxi Kurulumu')
  const [mcVersion, setMcVersion] = useState('')
  const [loader, setLoader] = useState<LoaderType>('alpinoxi')
  const [loaderVersion, setLoaderVersion] = useState('')
  const [clientEnabled, setClientEnabled] = useState(true)
  const [memoryMaxMb, setMemoryMaxMb] = useState(4096)
  const [builds, setBuilds] = useState<LoaderBuild[]>([])

  const [standaloneOpen, setStandaloneOpen] = useState(false)
  const [saName, setSaName] = useState('Yeni Mod Paketi')
  const [saMc, setSaMc] = useState('')
  const [saLoader, setSaLoader] = useState<LoaderType>('fabric')
  const [saLoaderVersion, setSaLoaderVersion] = useState('')
  const [saClient, setSaClient] = useState(false)
  const [saBuilds, setSaBuilds] = useState<LoaderBuild[]>([])

  const selected = instances.find((i) => i.id === selectedId) ?? null

  useEffect(() => {
    if (!saMc && versions.length > 0) setSaMc(versions[0].id)
  }, [versions, saMc])

  useEffect(() => {
    if (!standaloneOpen || !saMc || saLoader === 'vanilla') {
      setSaBuilds([])
      return
    }
    let active = true
    window.alpinoxi.versions
      .loaders(saMc)
      .then((list) => {
        if (!active) return
        const filtered = list.filter((b) => b.loader === saLoader)
        setSaBuilds(filtered)
        setSaLoaderVersion(filtered[0]?.version ?? '')
      })
      .catch(() => setSaBuilds([]))
    return () => {
      active = false
    }
  }, [standaloneOpen, saMc, saLoader])

  const createStandalonePack = async (): Promise<void> => {
    if (!saName.trim() || !saMc) return
    setBusy(true)
    try {
      const created = await window.alpinoxi.modpack.createStandalone({
        name: saName.trim(),
        mcVersion: saMc,
        loader: saLoader,
        loaderVersion: saLoaderVersion || undefined,
        includeClient: saClient
      })
      await refreshInstances()
      selectInstance(created.id)
      toast('success', `${created.name} bağımsız paket olarak oluşturuldu`)
      setStandaloneOpen(false)
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!mcVersion && versions.length > 0) setMcVersion(versions[0].id)
  }, [versions, mcVersion])

  useEffect(() => {
    if (!selected) {
      setMods([])
      return
    }
    setModsLoading(true)
    window.alpinoxi.instances
      .mods(selected.id)
      .then(setMods)
      .catch(() => setMods([]))
      .finally(() => setModsLoading(false))
  }, [selected?.id])

  useEffect(() => {
    if (!createOpen || !mcVersion || loader === 'vanilla') {
      setBuilds([])
      return
    }
    let active = true
    window.alpinoxi.versions
      .loaders(mcVersion)
      .then((list) => {
        if (!active) return
        const filtered = list.filter((b) => b.loader === loader)
        setBuilds(filtered)
        setLoaderVersion(filtered[0]?.version ?? '')
      })
      .catch(() => setBuilds([]))
    return () => {
      active = false
    }
  }, [createOpen, mcVersion, loader])

  const create = async (): Promise<void> => {
    if (!name.trim() || !mcVersion) return
    setBusy(true)
    try {
      const created = await window.alpinoxi.instances.create({
        name: name.trim(),
        mcVersion,
        loader,
        loaderVersion: loader === 'vanilla' ? undefined : loaderVersion || undefined,
        clientEnabled: loader === 'alpinoxi' ? true : clientEnabled,
        memoryMaxMb
      })
      await refreshInstances()
      selectInstance(created.id)
      toast('success', `${created.name} oluşturuldu`)
      setCreateOpen(false)
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const patch = async (id: string, p: Partial<Instance>): Promise<void> => {
    try {
      const updated = await window.alpinoxi.instances.update(id, p)
      useApp.getState().applyInstance(updated)
    } catch (e) {
      toast('error', errorMessage(e))
    }
  }

  const remove = async (id: string): Promise<void> => {
    try {
      await window.alpinoxi.instances.remove(id)
      await refreshInstances()
      toast('info', 'Kurulum silindi')
    } catch (e) {
      toast('error', errorMessage(e))
    }
  }

  const duplicate = async (id: string): Promise<void> => {
    try {
      const copy = await window.alpinoxi.instances.duplicate(id)
      await refreshInstances()
      selectInstance(copy.id)
      toast('success', 'Kurulum kopyalandı')
    } catch (e) {
      toast('error', errorMessage(e))
    }
  }

  const createModpack = async (id: string): Promise<void> => {
    const inst = instances.find((i) => i.id === id)
    if (!inst) return
    try {
      const path = await window.alpinoxi.modpack.createFromInstance(id, `${inst.name} Paketi`, inst.clientEnabled)
      toast('success', `Mod paketi oluşturuldu: ${path}`)
    } catch (e) {
      toast('error', errorMessage(e))
    }
  }

  const play = async (id: string): Promise<void> => {
    try {
      await window.alpinoxi.launch.start(id)
      useApp.setState({ launching: true, progress: null })
    } catch (e) {
      toast('error', errorMessage(e))
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Kurulumlar</h1>
          <p>Her sürüm ve loader için ayrı kurulum oluştur. Client modu veya modsuz — sen seç.</p>
        </div>
        <div className="spacer" />
        <button className="btn ghost" onClick={() => void window.alpinoxi.modpack.import().then(() => refreshInstances())}>
          <Upload size={15} /> .mrpack içe aktar
        </button>
        <button className="btn primary" onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> Yeni Kurulum
        </button>
      </div>

      {instances.length === 0 ? (
        <div className="card pad">
          <Empty
            icon={<Layers size={26} />}
            title="Kurulum bulunamadı"
            desc="İlk kurulumunu oluşturarak başla."
            action={
              <button className="btn primary" style={{ marginTop: 6 }} onClick={() => setCreateOpen(true)}>
                <Plus size={15} /> Kurulum oluştur
              </button>
            }
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {instances.map((inst) => (
              <div
                key={inst.id}
                className={`inst${inst.id === selectedId ? ' active' : ''}`}
                onClick={() => selectInstance(inst.id)}
              >
                <div className="top">
                  <div className="icon">{inst.name.slice(0, 1).toUpperCase()}</div>
                  <div className="grow">
                    <div className="title ellipsis">{inst.name}</div>
                    <div className="meta">
                      <span>{inst.mcVersion}</span>
                      <span>·</span>
                      <LoaderBadge loader={inst.loader} />
                    </div>
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn sm primary grow" onClick={(e) => { e.stopPropagation(); void play(inst.id) }}>
                    <Play size={13} /> Oyna
                  </button>
                  <button className="btn sm ghost icon" title="Kopyala" onClick={(e) => { e.stopPropagation(); void duplicate(inst.id) }}>
                    <Copy size={14} />
                  </button>
                  <button className="btn sm ghost icon" title="Sil" onClick={(e) => { e.stopPropagation(); void remove(inst.id) }}>
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {selected ? (
            <div className="card pad fade-enter" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="row">
                <div className="grow">
                  <h1 style={{ fontSize: 20 }}>{selected.name}</h1>
                  <div className="row muted" style={{ gap: 8, fontSize: 12.3, marginTop: 6 }}>
                    <span>{selected.mcVersion}</span>
                    <LoaderBadge loader={selected.loader} />
                    {selected.loaderVersion ? <span className="mono">{selected.loaderVersion}</span> : null}
                  </div>
                </div>
                <button
                  className="btn sm ghost"
                  onClick={() => {
                    const base = useApp.getState().appInfo?.instancesDir
                    if (base) void window.alpinoxi.app.openPath(`${base}\\${selected.id}`)
                  }}
                >
                  <FolderOpen size={14} /> Klasör
                </button>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <Field label="Kurulum adı">
                  <input
                    className="input"
                    defaultValue={selected.name}
                    onBlur={(e) => e.target.value !== selected.name && void patch(selected.id, { name: e.target.value })}
                  />
                </Field>
                <Field label="Bellek (MB)">
                  <input
                    className="input"
                    type="number"
                    defaultValue={selected.memoryMaxMb}
                    onBlur={(e) => void patch(selected.id, { memoryMaxMb: Number(e.target.value) || 2048 })}
                  />
                </Field>
                <Field label="Minimum bellek (MB)">
                  <input
                    className="input"
                    type="number"
                    defaultValue={selected.memoryMinMb}
                    onBlur={(e) => void patch(selected.id, { memoryMinMb: Number(e.target.value) || 512 })}
                  />
                </Field>
                <Field label="Java yolu (boş = otomatik)">
                  <input
                    className="input"
                    defaultValue={selected.javaPath ?? ''}
                    placeholder="C:\\...\\javaw.exe"
                    onBlur={(e) => void patch(selected.id, { javaPath: e.target.value || undefined })}
                  />
                </Field>
              </div>

              <Toggle
                label="Alpinoxi Client mod paketi (Sodium, Lithium, Iris…)"
                checked={selected.clientEnabled}
                onChange={(v) => void patch(selected.id, { clientEnabled: v })}
              />

              <div>
                <div className="row" style={{ marginBottom: 10 }}>
                  <Package size={15} />
                  <strong style={{ fontSize: 13.5 }}>Modlar</strong>
                  <span className="badge">{mods.length}</span>
                  <div className="spacer grow" />
                  <button
                    className="btn sm ghost"
                    onClick={() => {
                      setModsLoading(true)
                      window.alpinoxi.instances
                        .mods(selected.id)
                        .then(setMods)
                        .finally(() => setModsLoading(false))
                    }}
                  >
                    <RefreshCw size={13} className={modsLoading ? 'spin' : ''} /> Yenile
                  </button>
                </div>
                {mods.length === 0 ? (
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    Mod yok. Modrinth sekmesinden mod kurabilirsin.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {mods.map((mod) => (
                      <div key={mod} className="row" style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid var(--border)' }}>
                        <Cpu size={13} className="dim" />
                        <span className="grow ellipsis mono">{mod}</span>
                        <button
                          className="btn sm ghost icon"
                          onClick={() =>
                            void window.alpinoxi.instances.removeMod(selected.id, mod).then(() => setMods(mods.filter((m) => m !== mod)))
                          }
                        >
                          <Trash size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="row wrap" style={{ gap: 8 }}>
                <button className="btn sm ghost" onClick={() => void createModpack(selected.id)}>
                  <PackagePlus size={14} /> Mod paketi oluştur
                </button>
                <button
                  className="btn sm ghost"
                  onClick={() => void window.alpinoxi.modpack.export(selected.id).then((p) => p && toast('success', `Kaydedildi: ${p}`))}
                >
                  <Download size={14} /> .mrpack dışa aktar
                </button>
                <button className="btn sm" onClick={() => setStandaloneOpen(true)}>
                  <Package size={14} /> Bağımsız paket
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Modal
        open={createOpen}
        title="Yeni kurulum"
        desc="Sürüm ve loader seç. Alpinoxi Client modu performans modlarını otomatik kurar."
        onClose={() => setCreateOpen(false)}
        wide
      >
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Kurulum adı">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Minecraft sürümü">
            <select className="select" value={mcVersion} onChange={(e) => setMcVersion(e.target.value)}>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                  {v.type !== 'release' ? ` (${v.type})` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Loader">
            <select className="select" value={loader} onChange={(e) => setLoader(e.target.value as LoaderType)}>
              {LOADERS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Loader sürümü">
            <select
              className="select"
              value={loaderVersion}
              disabled={loader === 'vanilla' || builds.length === 0}
              onChange={(e) => setLoaderVersion(e.target.value)}
            >
              {loader === 'vanilla' ? (
                <option value="">—</option>
              ) : builds.length === 0 ? (
                <option value="">Yükleniyor…</option>
              ) : (
                builds.map((b) => (
                  <option key={b.version} value={b.version}>
                    {b.version}
                  </option>
                ))
              )}
            </select>
          </Field>
          <Field label="Maksimum bellek (MB)">
            <input className="input" type="number" value={memoryMaxMb} onChange={(e) => setMemoryMaxMb(Number(e.target.value))} />
          </Field>
        </div>
        <div style={{ marginTop: 14 }}>
          <Toggle
            label="Alpinoxi Client mod paketini uygula"
            checked={loader === 'alpinoxi' ? true : clientEnabled}
            onChange={setClientEnabled}
          />
        </div>
        <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={() => setCreateOpen(false)}>
            İptal
          </button>
          <button className="btn primary" disabled={busy || !mcVersion} onClick={() => void create()}>
            <Plus size={15} /> Oluştur
          </button>
        </div>
      </Modal>

      <Modal
        open={standaloneOpen}
        title="Bağımsız mod paketi"
        desc="Bu kurulumdan bağımsız, paylaşılabilir bir mod paketi kurulumu oluşturur."
        onClose={() => setStandaloneOpen(false)}
        wide
      >
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Paket adı">
            <input className="input" value={saName} onChange={(e) => setSaName(e.target.value)} />
          </Field>
          <Field label="Minecraft sürümü">
            <select className="select" value={saMc} onChange={(e) => setSaMc(e.target.value)}>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Loader">
            <select className="select" value={saLoader} onChange={(e) => setSaLoader(e.target.value as LoaderType)}>
              {LOADERS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Loader sürümü">
            <select
              className="select"
              value={saLoaderVersion}
              disabled={saLoader === 'vanilla' || saBuilds.length === 0}
              onChange={(e) => setSaLoaderVersion(e.target.value)}
            >
              {saLoader === 'vanilla' ? (
                <option value="">—</option>
              ) : saBuilds.length === 0 ? (
                <option value="">Yükleniyor…</option>
              ) : (
                saBuilds.map((b) => (
                  <option key={b.version} value={b.version}>
                    {b.version}
                  </option>
                ))
              )}
            </select>
          </Field>
        </div>
        <div style={{ marginTop: 14 }}>
          <Toggle label="Alpinoxi Client mod paketini dahil et" checked={saClient} onChange={setSaClient} />
        </div>
        <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={() => setStandaloneOpen(false)}>
            İptal
          </button>
          <button className="btn primary" disabled={busy || !saMc} onClick={() => void createStandalonePack()}>
            <Package size={15} /> Oluştur
          </button>
        </div>
      </Modal>
    </div>
  )
}
