import { useEffect, useState, type ReactNode } from 'react'
import { Download, Gamepad2, Search, SlidersHorizontal } from 'lucide-react'
import { Empty, Field, Modal } from '../components/ui'
import { errorMessage, toast, useApp } from '../store'
import type { ModrinthSearchHit, ModrinthVersion } from '@shared/types'

const LOADER_MAP: Record<string, string> = {
  alpinoxi: 'fabric',
  fabric: 'fabric',
  quilt: 'quilt',
  forge: 'forge',
  neoforge: 'neoforge',
  optifine: 'forge',
  vanilla: ''
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function Modrinth(): ReactNode {
  const instances = useApp((s) => s.instances)
  const selectedId = useApp((s) => s.selectedInstanceId)
  const [query, setQuery] = useState('')
  const [projectType, setProjectType] = useState('mod')
  const [hits, setHits] = useState<ModrinthSearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [target, setTarget] = useState<ModrinthSearchHit | null>(null)
  const [versions, setVersions] = useState<ModrinthVersion[]>([])
  const [versionId, setVersionId] = useState('')
  const [installing, setInstalling] = useState(false)

  const selected = instances.find((i) => i.id === selectedId) ?? instances[0] ?? null

  const run = async (): Promise<void> => {
    setLoading(true)
    try {
      const loader = selected ? LOADER_MAP[selected.loader] : ''
      const res = await window.alpinoxi.modrinth.search(query, {
        projectType,
        mcVersion: selected?.mcVersion,
        loader: loader || undefined,
        limit: 24
      })
      setHits(res.hits)
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectType, selectedId])

  const openTarget = async (hit: ModrinthSearchHit): Promise<void> => {
    setTarget(hit)
    setVersions([])
    setVersionId('')
    try {
      const loader = selected ? LOADER_MAP[selected.loader] : ''
      const list = await window.alpinoxi.modrinth.versions(hit.projectId, {
        mcVersion: selected?.mcVersion,
        loader: loader || undefined
      })
      const fallback = list.length > 0 ? list : await window.alpinoxi.modrinth.versions(hit.projectId)
      setVersions(fallback)
      setVersionId(fallback[0]?.id ?? '')
    } catch (e) {
      toast('error', errorMessage(e))
    }
  }

  const install = async (): Promise<void> => {
    if (!selected) {
      toast('error', 'Önce bir kurulum seç')
      return
    }
    const version = versions.find((v) => v.id === versionId)
    if (!version) return
    setInstalling(true)
    try {
      await window.alpinoxi.modrinth.install(selected.id, version)
      toast('success', `${version.name} → ${selected.name} kuruldu`)
      setTarget(null)
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Modrinth</h1>
          <p>Mod, shader, resource pack ve datapack indir. Bağımlılıklar otomatik çözülür.</p>
        </div>
        <div className="spacer" />
        <span className="badge">
          Hedef: {selected ? `${selected.name} · ${selected.mcVersion}` : 'kurulum yok'}
        </span>
      </div>

      <div className="card pad" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="grow row" style={{ gap: 10, minWidth: 260 }}>
          <Search size={16} className="dim" />
          <input
            className="input"
            style={{ border: 'none', background: 'transparent', padding: 0 }}
            placeholder="Mod ara… (örn. sodium, iris, jei)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void run()}
          />
        </div>
        <select className="select" style={{ width: 180 }} value={projectType} onChange={(e) => setProjectType(e.target.value)}>
          <option value="mod">Mod</option>
          <option value="shader">Shader</option>
          <option value="resourcepack">Resource Pack</option>
          <option value="datapack">Datapack</option>
          <option value="modpack">Modpack</option>
        </select>
        <button className="btn primary" disabled={loading} onClick={() => void run()}>
          <SlidersHorizontal size={15} /> Ara
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', marginTop: 16 }}>
        {hits.map((hit) => (
          <div key={hit.projectId} className="hit">
            <div className="top">
              {hit.iconUrl ? <img src={hit.iconUrl} alt="" /> : <div className="icon" style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--panel-solid)', display: 'grid', placeItems: 'center' }}><Gamepad2 size={20} className="dim" /></div>}
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 650, fontSize: 14 }} className="ellipsis">
                  {hit.title}
                </div>
                <div className="dim" style={{ fontSize: 11.5 }}>
                  {hit.author} · <Download size={10} /> {formatNumber(hit.downloads)}
                </div>
              </div>
            </div>
            <div className="desc">{hit.description}</div>
            <div className="chips">
              {hit.loaders.slice(0, 3).map((l) => (
                <span key={l} className="badge">
                  {l}
                </span>
              ))}
              {hit.categories.slice(0, 2).map((c) => (
                <span key={c} className="badge">
                  {c}
                </span>
              ))}
            </div>
            <button className="btn sm primary" onClick={() => void openTarget(hit)}>
              <Download size={14} /> Kur
            </button>
          </div>
        ))}
      </div>

      {!loading && hits.length === 0 ? (
        <div className="card pad" style={{ marginTop: 16 }}>
          <Empty icon={<Search size={24} />} title="Sonuç yok" desc="Farklı bir arama veya tür dene." />
        </div>
      ) : null}

      <Modal
        open={!!target}
        title={target?.title ?? ''}
        desc={selected ? `Hedef kurulum: ${selected.name} (${selected.mcVersion})` : 'Kurulum seçilmedi'}
        onClose={() => setTarget(null)}
      >
        <Field label="Sürüm">
          <select className="select" value={versionId} onChange={(e) => setVersionId(e.target.value)}>
            {versions.length === 0 ? (
              <option value="">Uygun sürüm yükleniyor…</option>
            ) : (
              versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.gameVersions.slice(0, 3).join(', ')} · {v.loaders.join('/') || 'genel'}
                </option>
              ))
            )}
          </select>
        </Field>
        <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={() => setTarget(null)}>
            İptal
          </button>
          <button className="btn primary" disabled={installing || !versionId} onClick={() => void install()}>
            <Download size={15} /> {installing ? 'Kuruluyor…' : 'Kur'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
