import type { Health } from '../types'
import { HEALTH_BG, HEALTH_COLOR } from '../data/config'
import { useApp } from '../context/AppContext'
import type { TKey } from '../i18n'

const LABEL_KEY: Record<Health, TKey> = {
  Green: 'health_green',
  Orange: 'health_orange',
  Red: 'health_red',
  Grey: 'health_grey',
  Blue: 'health_blue',
}

export function HealthBadge({ health }: { health: Health | '' }) {
  const { tr } = useApp()
  if (!health) return null
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: HEALTH_BG[health], color: HEALTH_COLOR[health] }}
      title={tr(LABEL_KEY[health])}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: HEALTH_COLOR[health] }} />
      {health}
    </span>
  )
}
