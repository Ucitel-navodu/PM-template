import { useApp } from '../context/AppContext'
import { formatMoney, formatPercent } from '../lib/format'
import { PAYMENT_STATUSES } from '../data/config'
import type { Milestone, PaymentStatus } from '../types'

const STATUS_COLOR: Record<PaymentStatus, string> = {
  'Not due': 'bg-gray-100 text-gray-600',
  Invoiced: 'bg-blue-50 text-blue-600',
  Paid: 'bg-green-50 text-green-700',
  Overdue: 'bg-red-50 text-red-700',
  Cancelled: 'bg-gray-100 text-gray-400 line-through',
}

let nextId = 100

function blankMilestone(): Milestone {
  nextId += 1
  return { id: `M${nextId}`, name: '', paymentTriggerPct: 0, paymentAmount: 0, paymentStatus: 'Not due' }
}

export function MilestonesPage() {
  const { tr, milestones, updateMilestone, deleteMilestone, addMilestone, tasks, projectInfo } = useApp()

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => addMilestone(blankMilestone())}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
        >
          + {tr('nav_milestones')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">{tr('milestones_name')}</th>
              <th className="px-3 py-2">{tr('milestones_linked_task')}</th>
              <th className="px-3 py-2">{tr('milestones_planned_date')}</th>
              <th className="px-3 py-2">{tr('milestones_trigger')}</th>
              <th className="px-3 py-2">{tr('milestones_amount')}</th>
              <th className="px-3 py-2">{tr('milestones_payment_status')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {milestones.map((m) => {
              const linkedTask = tasks.find((t) => t.id === m.linkedTaskId)
              return (
                <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-medium text-gray-500">{m.id}</td>
                  <td className="px-3 py-1.5">
                    <input
                      value={m.name}
                      onChange={(e) => updateMilestone(m.id, { name: e.target.value })}
                      className="w-56 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-gray-200 focus:border-gray-300 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-gray-500">{linkedTask?.name ?? '—'}</td>
                  <td className="px-3 py-1.5">
                    <input
                      type="date"
                      value={m.plannedDate ?? ''}
                      onChange={(e) => updateMilestone(m.id, { plannedDate: e.target.value || undefined })}
                      className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-gray-200"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-gray-600">{formatPercent(m.paymentTriggerPct)}</td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      value={m.paymentAmount}
                      onChange={(e) => updateMilestone(m.id, { paymentAmount: Number(e.target.value) })}
                      className="w-28 rounded border border-transparent bg-transparent px-1 py-0.5 text-right hover:border-gray-200 focus:border-gray-300 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={m.paymentStatus}
                      onChange={(e) => updateMilestone(m.id, { paymentStatus: e.target.value as PaymentStatus })}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[m.paymentStatus]}`}
                    >
                      {PAYMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button onClick={() => deleteMilestone(m.id)} className="text-xs text-gray-400 hover:text-red-600">
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50 font-medium">
              <td className="px-3 py-2" colSpan={5}>
                Total
              </td>
              <td className="px-3 py-2">
                {formatMoney(
                  milestones.reduce((s, m) => s + m.paymentAmount, 0),
                  projectInfo.currency,
                )}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
