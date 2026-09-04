import type { Health } from '../types'
import { HEALTH_BG, HEALTH_BG_DARK, HEALTH_COLOR, HEALTH_COLOR_DARK } from '../data/config'
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
  const { tr, theme } = useApp()
  if (!health) return null
  const color = theme === 'dark' ? HEALTH_COLOR_DARK[health] : HEALTH_COLOR[health]
  const bg = theme === 'dark' ? HEALTH_BG_DARK[health] : HEALTH_BG[health]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: bg, color }}
      title={tr(LABEL_KEY[health])}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {health}
    </span>
  )
}
