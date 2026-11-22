import type { ReactNode } from 'react'
import { Minus, Square, X } from 'lucide-react'

export default function TitleBar({ hint }: { hint?: string }): ReactNode {
  const api = window.alpinoxi.app
  return (
    <div className="titlebar">
      {hint ? <span className="hint">{hint}</span> : <span />}
      <div className="win-controls">
        <button className="win-btn" onClick={() => void api.minimize()} title="Küçült">
          <Minus size={15} />
        </button>
        <button className="win-btn" onClick={() => void api.maximize()} title="Büyüt">
          <Square size={12} />
        </button>
        <button className="win-btn close" onClick={() => void api.close()} title="Kapat">
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
