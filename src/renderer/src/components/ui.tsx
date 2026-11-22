import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({
  open,
  title,
  desc,
  onClose,
  children,
  wide
}: {
  open: boolean
  title: string
  desc?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}): ReactNode {
  if (!open) return null
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal fade-enter${wide ? ' wide' : ''}`}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <h3>{title}</h3>
            {desc ? <div className="desc">{desc}</div> : null}
          </div>
          <button className="btn ghost icon" onClick={onClose} title="Kapat">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}): ReactNode {
  return (
    <div className="toggle-row">
      <span className="lbl grow">{label}</span>
      <button className={`switch${checked ? ' on' : ''}`} onClick={() => onChange(!checked)} aria-pressed={checked}>
        <i />
      </button>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}): ReactNode {
  return (
    <div className="seg">
      {options.map((option) => (
        <button
          key={option.value}
          className={option.value === value ? 'active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Bar({ percent }: { percent: number }): ReactNode {
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${Math.max(2, Math.min(100, percent))}%` }} />
    </div>
  )
}

export function Empty({
  icon,
  title,
  desc,
  action
}: {
  icon: ReactNode
  title: string
  desc?: string
  action?: ReactNode
}): ReactNode {
  return (
    <div className="empty">
      <div className="icon-wrap">{icon}</div>
      <div style={{ fontWeight: 650, color: 'var(--text)' }}>{title}</div>
      {desc ? <div style={{ fontSize: 12.5 }}>{desc}</div> : null}
      {action}
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: ReactNode }): ReactNode {
  return (
    <div className="stat">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
    </div>
  )
}

export function LoaderBadge({ loader }: { loader: string }): ReactNode {
  const labels: Record<string, string> = {
    vanilla: 'Vanilla',
    fabric: 'Fabric',
    quilt: 'Quilt',
    forge: 'Forge',
    neoforge: 'NeoForge',
    optifine: 'OptiFine',
    alpinoxi: 'Alpinoxi'
  }
  return <span className="badge">{labels[loader] ?? loader}</span>
}
