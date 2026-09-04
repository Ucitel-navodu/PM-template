import { useApp } from '../context/AppContext'
import { formatMoney, formatPercent } from '../lib/format'
import { PAYMENT_STATUSES } from '../data/config'
import { btnPrimary, deleteBtn, inputGhost, selectGhost, tableWrap, tbodyRow, tfootRow, theadRow } from '../lib/ui'
import type { Milestone, PaymentStatus } from '../types'

const STATUS_COLOR: Record<PaymentStatus, string> = {
  'Not due': 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
  Invoiced: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  Paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Overdue: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  Cancelled: 'bg-gray-100 text-gray-400 line-through dark:bg-white/5 dark:text-gray-500',
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
        <button onClick={() => addMilestone(blankMilestone())} className={btnPrimary}>
          + {tr('nav_milestones')}
        </button>
      </div>

      <div className={tableWrap}>
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className={theadRow}>
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
                <tr key={m.id} className={tbodyRow}>
                  <td className="px-3 py-1.5 font-medium text-gray-500 dark:text-gray-400">{m.id}</td>
                  <td className="px-3 py-1.5">
                    <input
                      value={m.name}
                      onChange={(e) => updateMilestone(m.id, { name: e.target.value })}
                      className={`w-56 ${inputGhost}`}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{linkedTask?.name ?? '—'}</td>
                  <td className="px-3 py-1.5">
                    <input
                      type="date"
                      value={m.plannedDate ?? ''}
                      onChange={(e) => updateMilestone(m.id, { plannedDate: e.target.value || undefined })}
                      className={selectGhost}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{formatPercent(m.paymentTriggerPct)}</td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      value={m.paymentAmount}
                      onChange={(e) => updateMilestone(m.id, { paymentAmount: Number(e.target.value) })}
                      className={`w-28 text-right ${inputGhost}`}
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
                    <button onClick={() => deleteMilestone(m.id)} className={deleteBtn}>
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={tfootRow}>
              <td className="px-3 py-2" colSpan={5}>
                {tr('common_total')}
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
