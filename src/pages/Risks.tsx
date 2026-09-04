import { useApp } from '../context/AppContext'
import { formatDate } from '../lib/format'
import { IMPACT_LEVELS, RISK_STATUSES } from '../data/config'
import { btnPrimary, deleteBtn, inputGhost, selectGhost, tableWrap, tbodyRow, theadRow } from '../lib/ui'
import type { ImpactLevel, Risk, RiskStatus } from '../types'

const IMPACT_COLOR: Record<ImpactLevel, string> = {
  Low: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Medium: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  High: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  Critical: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
}

let nextId = 1

function blankRisk(): Risk {
  nextId += 1
  return {
    id: `R-${String(nextId).padStart(3, '0')}`,
    type: 'Risk',
    area: '',
    description: '',
    probability: 'Medium',
    impact: 'Medium',
    owner: '',
    mitigation: '',
    status: 'Open',
  }
}

export function RisksPage() {
  const { tr, risks, updateRisk, deleteRisk, addRisk } = useApp()

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => addRisk(blankRisk())} className={btnPrimary}>
          + {tr('nav_risks')}
        </button>
      </div>

      <div className={tableWrap}>
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className={theadRow}>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">{tr('risks_type')}</th>
              <th className="px-3 py-2">{tr('risks_description')}</th>
              <th className="px-3 py-2">{tr('risks_probability')}</th>
              <th className="px-3 py-2">{tr('risks_impact')}</th>
              <th className="px-3 py-2">{tr('common_owner')}</th>
              <th className="px-3 py-2">{tr('risks_mitigation')}</th>
              <th className="px-3 py-2">{tr('risks_due_date')}</th>
              <th className="px-3 py-2">{tr('common_status')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {risks.map((r) => (
              <tr key={r.id} className={tbodyRow}>
                <td className="px-3 py-1.5 font-medium text-gray-500 dark:text-gray-400">{r.id}</td>
                <td className="px-3 py-1.5">
                  <select
                    value={r.type}
                    onChange={(e) => updateRisk(r.id, { type: e.target.value as Risk['type'] })}
                    className={selectGhost}
                  >
                    <option value="Risk">Risk</option>
                    <option value="Issue">Issue</option>
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input
                    value={r.description}
                    onChange={(e) => updateRisk(r.id, { description: e.target.value })}
                    className={`w-64 ${inputGhost}`}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <select
                    value={r.probability}
                    onChange={(e) => updateRisk(r.id, { probability: e.target.value as ImpactLevel })}
                    className={`rounded px-2 py-0.5 text-xs font-medium ${IMPACT_COLOR[r.probability]}`}
                  >
                    {IMPACT_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <select
                    value={r.impact}
                    onChange={(e) => updateRisk(r.id, { impact: e.target.value as ImpactLevel })}
                    className={`rounded px-2 py-0.5 text-xs font-medium ${IMPACT_COLOR[r.impact]}`}
                  >
                    {IMPACT_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input
                    value={r.owner}
                    onChange={(e) => updateRisk(r.id, { owner: e.target.value })}
                    className={`w-28 ${inputGhost}`}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    value={r.mitigation}
                    onChange={(e) => updateRisk(r.id, { mitigation: e.target.value })}
                    className={`w-56 ${inputGhost}`}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="date"
                    value={r.dueDate ?? ''}
                    onChange={(e) => updateRisk(r.id, { dueDate: e.target.value || undefined })}
                    className={selectGhost}
                  />
                  <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">{formatDate(r.dueDate)}</span>
                </td>
                <td className="px-3 py-1.5">
                  <select
                    value={r.status}
                    onChange={(e) => updateRisk(r.id, { status: e.target.value as RiskStatus })}
                    className={selectGhost}
                  >
                    {RISK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button onClick={() => deleteRisk(r.id)} className={deleteBtn}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
