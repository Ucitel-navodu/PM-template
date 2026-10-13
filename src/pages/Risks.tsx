import { useApp } from '../context/AppContext'
import { IMPACT_LEVELS, RISK_STATUSES } from '../data/config'
import { nextSequentialId } from '../lib/ids'
import { toDateKey } from '../lib/dates'
import { btnPrimary, deleteBtn, inputGhost, selectGhost, tableWrap, tbodyRow, theadRow } from '../lib/ui'
import type { ImpactLevel, Risk, RiskStatus } from '../types'

const IMPACT_COLOR: Record<ImpactLevel, string> = {
  Low: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Medium: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  High: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  Critical: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
}

const LEVEL_SCORE: Record<ImpactLevel, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 }

// Probability x Impact (1..16), the CONFIG sheet's ProbabilityImpact matrix.
function riskScore(r: Risk): number {
  return LEVEL_SCORE[r.probability] * LEVEL_SCORE[r.impact]
}

function scoreClass(score: number): string {
  if (score >= 9) return 'bg-rose-500 text-white'
  if (score >= 4) return 'bg-amber-400 text-gray-900'
  return 'bg-emerald-500 text-white'
}

export function RisksPage() {
  const { tr, risks, updateRisk, deleteRisk, addRisk, tasks, settings } = useApp()

  // Every edit stamps "last update", like keeping the register's date current by hand.
  const edit = (id: string, patch: Partial<Risk>) => updateRisk(id, { ...patch, lastUpdate: toDateKey(new Date()) })

  const add = () =>
    addRisk({
      id: nextSequentialId(
        risks.map((r) => r.id),
        'R-',
        3,
      ),
      type: 'Risk',
      area: '',
      description: '',
      probability: 'Medium',
      impact: 'Medium',
      owner: '',
      mitigation: '',
      status: 'Open',
      lastUpdate: toDateKey(new Date()),
    })

  const th = 'px-3 py-2 whitespace-nowrap'
  const td = 'px-3 py-1.5'
  const areaOptions = (current: string) =>
    current && !settings.projectAreas.includes(current) ? [...settings.projectAreas, current] : settings.projectAreas

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={add} className={btnPrimary}>
          + {tr('nav_risks')}
        </button>
      </div>

      <div className={tableWrap}>
        <table className="w-full min-w-[1750px] text-sm">
          <thead>
            <tr className={theadRow}>
              <th className={th}>ID</th>
              <th className={th}>{tr('risks_type')}</th>
              <th className={th}>{tr('common_project_area')}</th>
              <th className={th}>{tr('risks_linked_task')}</th>
              <th className={th}>{tr('risks_description')}</th>
              <th className={th}>{tr('risks_probability')}</th>
              <th className={th}>{tr('risks_impact')}</th>
              <th className={th}>P×I</th>
              <th className={th}>{tr('common_owner')}</th>
              <th className={th}>{tr('risks_mitigation')}</th>
              <th className={th}>{tr('risks_due_date')}</th>
              <th className={th}>{tr('common_status')}</th>
              <th className={th}>{tr('risks_last_update')}</th>
              <th className={th}>{tr('risks_comment')}</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {risks.map((r) => {
              const score = riskScore(r)
              return (
                <tr key={r.id} className={tbodyRow}>
                  <td className={`${td} whitespace-nowrap font-medium text-gray-500 dark:text-gray-400`}>{r.id}</td>
                  <td className={td}>
                    <select
                      value={r.type}
                      onChange={(e) => edit(r.id, { type: e.target.value as Risk['type'] })}
                      className={selectGhost}
                    >
                      <option value="Risk">Risk</option>
                      <option value="Issue">Issue</option>
                    </select>
                  </td>
                  <td className={td}>
                    <select value={r.area} onChange={(e) => edit(r.id, { area: e.target.value })} className={selectGhost}>
                      <option value="">—</option>
                      {areaOptions(r.area).map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={td}>
                    <select
                      value={r.linkedTaskId ?? ''}
                      onChange={(e) => edit(r.id, { linkedTaskId: e.target.value || undefined })}
                      className={`max-w-[180px] ${selectGhost}`}
                    >
                      <option value="">—</option>
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.wbs ? `${t.wbs} · ` : ''}
                          {t.name || t.id}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={td}>
                    <input
                      value={r.description}
                      onChange={(e) => edit(r.id, { description: e.target.value })}
                      className={`w-64 ${inputGhost}`}
                    />
                  </td>
                  {(['probability', 'impact'] as const).map((k) => (
                    <td key={k} className={td}>
                      <select
                        value={r[k]}
                        onChange={(e) => edit(r.id, { [k]: e.target.value as ImpactLevel })}
                        className={`rounded px-2 py-0.5 text-xs font-medium ${IMPACT_COLOR[r[k]]}`}
                      >
                        {IMPACT_LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                  <td className={td}>
                    <span className={`inline-block min-w-[1.75rem] rounded px-1.5 py-0.5 text-center text-xs font-semibold ${scoreClass(score)}`}>
                      {score}
                    </span>
                  </td>
                  <td className={td}>
                    <input value={r.owner} onChange={(e) => edit(r.id, { owner: e.target.value })} className={`w-28 ${inputGhost}`} />
                  </td>
                  <td className={td}>
                    <input
                      value={r.mitigation}
                      onChange={(e) => edit(r.id, { mitigation: e.target.value })}
                      className={`w-56 ${inputGhost}`}
                    />
                  </td>
                  <td className={td}>
                    <input
                      type="date"
                      value={r.dueDate ?? ''}
                      onChange={(e) => edit(r.id, { dueDate: e.target.value || undefined })}
                      className={selectGhost}
                    />
                  </td>
                  <td className={td}>
                    <select
                      value={r.status}
                      onChange={(e) => edit(r.id, { status: e.target.value as RiskStatus })}
                      className={selectGhost}
                    >
                      {RISK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`${td} whitespace-nowrap text-xs text-gray-500 dark:text-gray-400`}>{r.lastUpdate ?? ''}</td>
                  <td className={td}>
                    <input
                      value={r.comment ?? ''}
                      onChange={(e) => edit(r.id, { comment: e.target.value || undefined })}
                      className={`w-48 ${inputGhost}`}
                    />
                  </td>
                  <td className={`${td} text-right`}>
                    <button onClick={() => deleteRisk(r.id)} className={deleteBtn}>
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
