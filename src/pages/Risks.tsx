import { useApp } from '../context/AppContext'
import { formatDate } from '../lib/format'
import { IMPACT_LEVELS, RISK_STATUSES } from '../data/config'
import type { ImpactLevel, Risk, RiskStatus } from '../types'

const IMPACT_COLOR: Record<ImpactLevel, string> = {
  Low: 'bg-green-50 text-green-700',
  Medium: 'bg-yellow-50 text-yellow-700',
  High: 'bg-orange-50 text-orange-700',
  Critical: 'bg-red-50 text-red-700',
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
        <button
          onClick={() => addRisk(blankRisk())}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
        >
          + {tr('nav_risks')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
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
              <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-3 py-1.5 font-medium text-gray-500">{r.id}</td>
                <td className="px-3 py-1.5">
                  <select
                    value={r.type}
                    onChange={(e) => updateRisk(r.id, { type: e.target.value as Risk['type'] })}
                    className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-gray-200"
                  >
                    <option value="Risk">Risk</option>
                    <option value="Issue">Issue</option>
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input
                    value={r.description}
                    onChange={(e) => updateRisk(r.id, { description: e.target.value })}
                    className="w-64 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-gray-200 focus:border-gray-300 focus:bg-white focus:outline-none"
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
                    className="w-28 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-gray-200 focus:border-gray-300 focus:bg-white focus:outline-none"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    value={r.mitigation}
                    onChange={(e) => updateRisk(r.id, { mitigation: e.target.value })}
                    className="w-56 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-gray-200 focus:border-gray-300 focus:bg-white focus:outline-none"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="date"
                    value={r.dueDate ?? ''}
                    onChange={(e) => updateRisk(r.id, { dueDate: e.target.value || undefined })}
                    className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-gray-200"
                  />
                  <span className="ml-1 text-xs text-gray-400">{formatDate(r.dueDate)}</span>
                </td>
                <td className="px-3 py-1.5">
                  <select
                    value={r.status}
                    onChange={(e) => updateRisk(r.id, { status: e.target.value as RiskStatus })}
                    className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-gray-200"
                  >
                    {RISK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button onClick={() => deleteRisk(r.id)} className="text-xs text-gray-400 hover:text-red-600">
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
