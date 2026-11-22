import { useEffect, useState, type ReactNode } from 'react'

const TIPS = [
  'Sodium + Lithium ile yüksek FPS',
  'Modrinth modlarını tek tıkla kur',
  'Kozmetiklerini ely.by ile yönet',
  'Arkadaşlarınla parti kur',
  'Animated cape ve skin desteği',
  'Her sürüm, her loader'
]

export default function Splash({ onDone }: { onDone: () => void }): ReactNode {
  const [tip, setTip] = useState(0)

  useEffect(() => {
    const rotate = window.setInterval(() => setTip((t) => (t + 1) % TIPS.length), 900)
    const finish = window.setTimeout(onDone, 2100)
    return () => {
      window.clearInterval(rotate)
      window.clearTimeout(finish)
    }
  }, [onDone])

  return (
    <div className="splash">
      <div className="splash-inner fade-enter">
        <div className="splash-logo">A</div>
        <h1>
          Alpinoxi <span>Client</span>
        </h1>
        <div className="tip">{TIPS[tip]}</div>
        <div className="loadbar">
          <i />
        </div>
      </div>
    </div>
  )
}
