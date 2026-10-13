import { useApp } from '../context/AppContext'
import { formatMoney } from '../lib/format'
import { PAYMENT_STATUSES } from '../data/config'
import { nextSequentialId } from '../lib/ids'
import { btnPrimary, deleteBtn, inputGhost, selectGhost, tableWrap, tbodyRow, tfootRow, theadRow } from '../lib/ui'
import type { BudgetItem, PaymentStatus } from '../types'

function blankItem(existing: BudgetItem[], category: string): BudgetItem {
  return {
    id: nextSequentialId(
      existing.map((b) => b.id),
      'B',
      3,
    ),
    category,
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
  const { tr, budget, updateBudgetItem, deleteBudgetItem, addBudgetItem, projectInfo, milestones, settings } = useApp()

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
        <button onClick={() => addBudgetItem(blankItem(budget, settings.budgetCategories[settings.budgetCategories.length - 1] ?? ''))} className={btnPrimary}>
          + {tr('nav_budget')}
        </button>
      </div>

      <div className={tableWrap}>
        <table className="w-full min-w-[1600px] text-sm">
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
              <th className="px-3 py-2">{tr('budget_due_date')}</th>
              <th className="px-3 py-2">{tr('milestones_payment_status')}</th>
              <th className="px-3 py-2">{tr('common_invoice_no')}</th>
              <th className="px-3 py-2">{tr('common_notes')}</th>
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
                      onChange={(e) => updateBudgetItem(b.id, { category: e.target.value })}
                      className={selectGhost}
                    >
                      {(settings.budgetCategories.includes(b.category) ? settings.budgetCategories : [...settings.budgetCategories, b.category]).map((c) => (
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
                    <input
                      type="date"
                      value={b.dueDate ?? ''}
                      onChange={(e) => updateBudgetItem(b.id, { dueDate: e.target.value || undefined })}
                      className={selectGhost}
                    />
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
                  <td className="px-3 py-1.5">
                    <input
                      value={b.invoiceNo ?? ''}
                      onChange={(e) => updateBudgetItem(b.id, { invoiceNo: e.target.value || undefined })}
                      className={`w-24 ${inputGhost}`}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      value={b.notes ?? ''}
                      onChange={(e) => updateBudgetItem(b.id, { notes: e.target.value || undefined })}
                      className={`w-48 ${inputGhost}`}
                    />
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
              <td colSpan={5} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
