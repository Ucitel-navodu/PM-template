import { useApp } from '../context/AppContext'
import { formatMoney } from '../lib/format'
import { BUDGET_CATEGORIES, PAYMENT_STATUSES } from '../data/config'
import { btnPrimary, deleteBtn, inputGhost, selectGhost, tableWrap, tbodyRow, tfootRow, theadRow } from '../lib/ui'
import type { BudgetCategory, BudgetItem, PaymentStatus } from '../types'

let nextId = 100

function blankItem(): BudgetItem {
  nextId += 1
  return {
    id: `B${nextId}`,
    category: 'Other',
    supplier: '',
    description: '',
    planned: 0,
    committed: 0,
    actual: 0,
    paymentStatus: 'Not due',
  }
}

function forecast(item: BudgetItem): number {
  return Math.max(item.actual, item.committed, item.planned)
}

export function BudgetPage() {
  const { tr, budget, updateBudgetItem, deleteBudgetItem, addBudgetItem, projectInfo, milestones } = useApp()

  const totals = budget.reduce(
    (acc, b) => ({
      planned: acc.planned + b.planned,
      committed: acc.committed + b.committed,
      actual: acc.actual + b.actual,
      forecast: acc.forecast + forecast(b),
    }),
    { planned: 0, committed: 0, actual: 0, forecast: 0 },
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => addBudgetItem(blankItem())} className={btnPrimary}>
          + {tr('nav_budget')}
        </button>
      </div>

      <div className={tableWrap}>
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className={theadRow}>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">{tr('budget_category')}</th>
              <th className="px-3 py-2">{tr('budget_supplier')}</th>
              <th className="px-3 py-2">{tr('budget_description')}</th>
              <th className="px-3 py-2">{tr('budget_linked_milestone')}</th>
              <th className="px-3 py-2 text-right">{tr('budget_planned')}</th>
              <th className="px-3 py-2 text-right">{tr('budget_committed')}</th>
              <th className="px-3 py-2 text-right">{tr('budget_actual')}</th>
              <th className="px-3 py-2 text-right">{tr('budget_forecast')}</th>
              <th className="px-3 py-2 text-right">{tr('budget_variance')}</th>
              <th className="px-3 py-2">{tr('milestones_payment_status')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {budget.map((b) => {
              const fc = forecast(b)
              const variance = b.planned - fc
              return (
                <tr key={b.id} className={tbodyRow}>
                  <td className="px-3 py-1.5 font-medium text-gray-500 dark:text-gray-400">{b.id}</td>
                  <td className="px-3 py-1.5">
                    <select
                      value={b.category}
                      onChange={(e) => updateBudgetItem(b.id, { category: e.target.value as BudgetCategory })}
                      className={selectGhost}
                    >
                      {BUDGET_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      value={b.supplier}
                      onChange={(e) => updateBudgetItem(b.id, { supplier: e.target.value })}
                      className={`w-24 ${inputGhost}`}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      value={b.description}
                      onChange={(e) => updateBudgetItem(b.id, { description: e.target.value })}
                      className={`w-52 ${inputGhost}`}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={b.linkedMilestoneId ?? ''}
                      onChange={(e) => updateBudgetItem(b.id, { linkedMilestoneId: e.target.value || undefined })}
                      className={selectGhost}
                    >
                      <option value="">—</option>
                      {milestones.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="number"
                      value={b.planned}
                      onChange={(e) => updateBudgetItem(b.id, { planned: Number(e.target.value) })}
                      className={`w-24 text-right ${inputGhost}`}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="number"
                      value={b.committed}
                      onChange={(e) => updateBudgetItem(b.id, { committed: Number(e.target.value) })}
                      className={`w-24 text-right ${inputGhost}`}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="number"
                      value={b.actual}
                      onChange={(e) => updateBudgetItem(b.id, { actual: Number(e.target.value) })}
                      className={`w-24 text-right ${inputGhost}`}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-300">
                    {formatMoney(fc, projectInfo.currency)}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right ${variance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-600 dark:text-gray-300'}`}
                  >
                    {formatMoney(variance, projectInfo.currency)}
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={b.paymentStatus}
                      onChange={(e) => updateBudgetItem(b.id, { paymentStatus: e.target.value as PaymentStatus })}
                      className={selectGhost}
                    >
                      {PAYMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button onClick={() => deleteBudgetItem(b.id)} className={deleteBtn}>
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
                {tr('common_total')} ({tr('budget_approved')}: {formatMoney(projectInfo.budget, projectInfo.currency)})
              </td>
              <td className="px-3 py-2 text-right">{formatMoney(totals.planned, projectInfo.currency)}</td>
              <td className="px-3 py-2 text-right">{formatMoney(totals.committed, projectInfo.currency)}</td>
              <td className="px-3 py-2 text-right">{formatMoney(totals.actual, projectInfo.currency)}</td>
              <td className="px-3 py-2 text-right">{formatMoney(totals.forecast, projectInfo.currency)}</td>
              <td className="px-3 py-2 text-right">
                {formatMoney(projectInfo.budget - totals.forecast, projectInfo.currency)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
