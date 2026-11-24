import type { ImpactLevel, Risk } from '../types'
import { IMPACT_LEVELS } from '../data/config'
import { useApp } from '../context/AppContext'
import { IMPACT_LEVELS_DESC, riskMatrix, riskScore, scoreClass } from '../lib/raid'

/**
 * P x I risk map (open risks and issues). Interactive in the RAID tab (a click
 * filters the register), static in the status report and its print.
 */
export function RiskMatrix({ items, cell, onCell, compact = false }: { items: Risk[]; cell?: [ImpactLevel, ImpactLevel]; onCell?: (c?: [ImpactLevel, ImpactLevel]) => void; compact?: boolean }) {
  const { tr } = useApp()
  const m = riskMatrix(items)
  return (
    <div data-testid="risk-matrix">
      <div className="grid grid-cols-[auto_repeat(4,minmax(2.5rem,1fr))] gap-1 text-xs">
        {IMPACT_LEVELS_DESC.map((p) => (
          <div key={p} className="contents">
            <div className="flex items-center pr-1 text-gray-500 dark:text-gray-400">{p}</div>
            {IMPACT_LEVELS.map((i) => {
              const n = m[p][i]
              const active = cell?.[0] === p && cell?.[1] === i
              const cls = `${compact ? 'h-7' : 'h-9'} flex items-center justify-center rounded font-semibold ${scoreClass(riskScore({ probability: p, impact: i }))} ${n ? '' : 'opacity-40 print:opacity-30'}`
              return onCell ? (
                <button key={i} data-cell={`${p}-${i}`} onClick={() => onCell(active ? undefined : [p, i])} className={`${cls} ${active ? 'ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-[rgb(var(--pm-card))]' : ''}`}>
                  {n || ''}
                </button>
              ) : (
                <div key={i} data-cell={`${p}-${i}`} className={cls}>
                  {n || ''}
                </div>
              )
            })}
          </div>
        ))}
        <div />
        {IMPACT_LEVELS.map((i) => (
          <div key={i} className="text-center text-gray-500 dark:text-gray-400">
            {i}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <span>↑ {tr('risks_probability')}</span>
        <span>{tr('risks_impact')} →</span>
      </div>
    </div>
  )
}
