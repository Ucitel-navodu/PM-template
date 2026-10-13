import { useApp } from '../context/AppContext'
import { formatMoney } from '../lib/format'
import { PAYMENT_STATUSES } from '../data/config'
import { nextSequentialId } from '../lib/ids'
import { milestoneAmount, milestoneVarianceDays } from '../lib/milestones'
import { btnPrimary, deleteBtn, inputGhost, selectGhost, tableWrap, tbodyRow, tfootRow, theadRow } from '../lib/ui'
import type { PaymentStatus } from '../types'

const STATUS_COLOR: Record<PaymentStatus, string> = {
  'Not due': 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
  Invoiced: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  Paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Overdue: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  Cancelled: 'bg-gray-100 text-gray-400 line-through dark:bg-white/5 dark:text-gray-500',
}

export function MilestonesPage() {
  const { tr, milestones, updateMilestone, deleteMilestone, addMilestone, tasks, projectInfo } = useApp()

  const add = () =>
    addMilestone({
      id: nextSequentialId(
        milestones.map((m) => m.id),
        'M',
        2,
      ),
      name: '',
      paymentTriggerPct: 0,
      paymentStatus: 'Not due',
    })

  const totalPct = milestones.reduce((s, m) => s + (m.paymentTriggerPct || 0), 0)
  const th = 'px-3 py-2 whitespace-nowrap'
  const td = 'px-3 py-1.5'

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={add} className={btnPrimary}>
          + {tr('nav_milestones')}
        </button>
      </div>

      <div className={tableWrap}>
        <table className="w-full min-w-[1500px] text-sm">
          <thead>
            <tr className={theadRow}>
              <th className={th}>ID</th>
              <th className={th}>{tr('milestones_name')}</th>
              <th className={th}>{tr('milestones_linked_task')}</th>
              <th className={th}>{tr('milestones_trigger')}</th>
              <th className={`${th} text-right`}>{tr('milestones_amount')}</th>
              <th className={th}>{tr('milestones_payment_status')}</th>
              <th className={th}>{tr('milestones_planned_date')}</th>
              <th className={th}>{tr('milestones_baseline_date')}</th>
              <th className={th}>{tr('milestones_actual_date')}</th>
              <th className={th}>{tr('milestones_variance')}</th>
              <th className={th}>{tr('common_invoice_no')}</th>
              <th className={th}>{tr('common_notes')}</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {milestones.map((m) => {
              const variance = milestoneVarianceDays(m)
              return (
                <tr key={m.id} className={tbodyRow}>
                  <td className={`${td} font-medium text-gray-500 dark:text-gray-400`}>{m.id}</td>
                  <td className={td}>
                    <input
                      value={m.name}
                      onChange={(e) => updateMilestone(m.id, { name: e.target.value })}
                      className={`w-44 ${inputGhost}`}
                    />
                  </td>
                  <td className={td}>
                    <select
                      value={m.linkedTaskId ?? ''}
                      onChange={(e) => updateMilestone(m.id, { linkedTaskId: e.target.value || undefined })}
                      className={`max-w-[170px] ${selectGhost}`}
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
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round((m.paymentTriggerPct || 0) * 1000) / 10}
                      onChange={(e) => updateMilestone(m.id, { paymentTriggerPct: Number(e.target.value) / 100 })}
                      className={`w-16 text-right ${inputGhost}`}
                    />
                    <span className="text-xs text-gray-400">%</span>
                  </td>
                  <td className={`${td} text-right text-gray-700 dark:text-gray-200`}>
                    {formatMoney(milestoneAmount(m, projectInfo.budget), projectInfo.currency)}
                  </td>
                  <td className={td}>
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
                  {(['plannedDate', 'baselineDate', 'actualDate'] as const).map((k) => (
                    <td key={k} className={td}>
                      <input
                        type="date"
                        value={m[k] ?? ''}
                        onChange={(e) => updateMilestone(m.id, { [k]: e.target.value || undefined })}
                        className={selectGhost}
                      />
                    </td>
                  ))}
                  <td
                    className={`${td} ${variance && variance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    {variance === null ? '' : `${variance > 0 ? '+' : ''}${variance} d`}
                  </td>
                  <td className={td}>
                    <input
                      value={m.invoiceNo ?? ''}
                      onChange={(e) => updateMilestone(m.id, { invoiceNo: e.target.value || undefined })}
                      className={`w-24 ${inputGhost}`}
                    />
                  </td>
                  <td className={td}>
                    <input
                      value={m.notes ?? ''}
                      onChange={(e) => updateMilestone(m.id, { notes: e.target.value || undefined })}
                      className={`w-48 ${inputGhost}`}
                    />
                  </td>
                  <td className={`${td} text-right`}>
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
              <td className="px-3 py-2" colSpan={3}>
                {tr('common_total')}
              </td>
              <td className={`px-3 py-2 ${Math.abs(totalPct - 1) > 0.0001 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                {Math.round(totalPct * 1000) / 10} %
              </td>
              <td className="px-3 py-2 text-right">
                {formatMoney(
                  milestones.reduce((s, m) => s + milestoneAmount(m, projectInfo.budget), 0),
                  projectInfo.currency,
                )}
              </td>
              <td colSpan={8} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
