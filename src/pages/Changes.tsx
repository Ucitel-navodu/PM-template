import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { useActiveProject, useWorkspaceStore } from '../store/workspaceStore'
import { usePrefsStore } from '../store/prefsStore'
import { CHANGE_STATUSES, CHANGE_TYPES } from '../data/config'
import { nextSequentialId } from '../lib/ids'
import { toDateKey } from '../lib/dates'
import { formatDate, formatMoney } from '../lib/format'
import { approvedImpact } from '../lib/changes'
import { Card, Stat } from '../components/Card'
import { btnPrimary, deleteBtn, inputGhost, selectGhost, tableWrap, tbodyRow, theadRow } from '../lib/ui'
import type { ChangeRequest, ChangeStatus } from '../types'

const STATUS_CLASS: Record<ChangeStatus, string> = {
  Open: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  Approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Rejected: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  Implemented: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  Closed: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
}

/** Affected tasks entered as task numbers (# column), e.g. "7; 8". */
function TaskNumbersInput({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const tasks = useActiveProject()?.tasks ?? []
  const text = ids.map((id) => tasks.find((t) => t.id === id)?.no).filter(Boolean).join('; ')
  const names = ids.map((id) => tasks.find((t) => t.id === id)).filter(Boolean).map((t) => `#${t!.no} ${t!.name}`)
  return (
    <input
      key={text}
      defaultValue={text}
      placeholder="7; 8"
      title={names.join('\n')}
      onBlur={(e) => {
        const nos = e.target.value.split(/[;,\s]+/).map(Number).filter(Boolean)
        const next = nos.map((n) => tasks.find((t) => t.no === n)?.id).filter((x): x is string => Boolean(x))
        if (next.join() !== ids.join()) onChange([...new Set(next)])
        else e.target.value = text
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={`w-24 ${inputGhost}`}
    />
  )
}

export function ChangesPage() {
  const { tr, readOnly, projectInfo } = useApp()
  const project = useActiveProject()
  const store = useWorkspaceStore.getState()
  const changes = useMemo(() => project?.changes ?? [], [project?.changes])
  const impact = approvedImpact(changes)
  const open = changes.filter((c) => c.status === 'Open').length

  const edit = (id: string, patch: Partial<ChangeRequest>) => store.updateItem('changes', id, patch)

  const add = () =>
    store.addItem('changes', {
      id: nextSequentialId(
        changes.map((c) => c.id),
        'CR-',
        3,
      ),
      title: '',
      description: '',
      type: 'Scope',
      status: 'Open',
      requestedBy: usePrefsStore.getState().userName,
      raised: toDateKey(new Date()),
      impactDays: 0,
      impactCost: 0,
      linkedTaskIds: [],
    })

  const decide = (c: ChangeRequest, approve: boolean) => {
    if (!usePrefsStore.getState().userName.trim()) window.alert(tr('cr_no_user'))
    if (!approve) return store.decideChange(c.id, false)
    const baseline = window.confirm(tr('cr_approve_baseline'))
    const decision = window.confirm(tr('cr_approve_decision'))
    store.decideChange(c.id, true, { baseline, decision })
  }

  const th = 'px-2 py-2 whitespace-nowrap'
  const td = 'px-2 py-1 align-top'

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">{tr('cr_help')}</p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <Stat label={tr('cr_open')} value={open} />
        </Card>
        <Card>
          <Stat label={tr('cr_approved_days')} value={`${impact.days > 0 ? '+' : ''}${impact.days} pd`} />
        </Card>
        <Card>
          <Stat label={tr('cr_approved_cost')} value={formatMoney(impact.cost, projectInfo.currency)} />
        </Card>
        <Card>
          <Stat label={tr('budget_current')} value={formatMoney(projectInfo.budget + impact.cost, projectInfo.currency)} />
        </Card>
      </div>

      <div className="flex justify-end">
        <button className={btnPrimary} onClick={add} disabled={readOnly}>
          {tr('cr_add')}
        </button>
      </div>

      <div className={tableWrap}>
        <table className="w-full min-w-[1500px] text-sm">
          <thead>
            <tr className={theadRow}>
              <th className={th}>ID</th>
              <th className={th}>{tr('cr_title')}</th>
              <th className={th}>{tr('risks_description')}</th>
              <th className={th}>{tr('cr_type')}</th>
              <th className={th}>{tr('cr_requested_by')}</th>
              <th className={th}>{tr('cr_raised')}</th>
              <th className={th}>{tr('cr_impact_days')}</th>
              <th className={th}>{tr('cr_impact_cost').replace('Kč', projectInfo.currency)}</th>
              <th className={th}>{tr('cr_tasks')}</th>
              <th className={th}>{tr('common_status')}</th>
              <th className={th}>{tr('cr_decided')}</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.id} className={tbodyRow} data-cr-id={c.id}>
                <td className={`${td} whitespace-nowrap font-medium text-gray-500 dark:text-gray-400`}>{c.id}</td>
                <td className={td}>
                  <input value={c.title} onChange={(e) => edit(c.id, { title: e.target.value })} className={`w-48 font-medium ${inputGhost}`} />
                </td>
                <td className={td}>
                  <input value={c.description} onChange={(e) => edit(c.id, { description: e.target.value })} className={`w-72 ${inputGhost}`} />
                </td>
                <td className={td}>
                  <select value={c.type} onChange={(e) => edit(c.id, { type: e.target.value as ChangeRequest['type'] })} className={selectGhost}>
                    {CHANGE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={td}>
                  <input value={c.requestedBy} onChange={(e) => edit(c.id, { requestedBy: e.target.value })} className={`w-28 ${inputGhost}`} />
                </td>
                <td className={td}>
                  <input type="date" value={c.raised} onChange={(e) => edit(c.id, { raised: e.target.value })} className={selectGhost} />
                </td>
                <td className={td}>
                  <input type="number" value={c.impactDays} onChange={(e) => edit(c.id, { impactDays: Math.round(Number(e.target.value) || 0) })} className={`w-16 ${inputGhost}`} />
                </td>
                <td className={td}>
                  <input type="number" value={c.impactCost} onChange={(e) => edit(c.id, { impactCost: Number(e.target.value) || 0 })} className={`w-28 ${inputGhost}`} />
                </td>
                <td className={td}>
                  <TaskNumbersInput ids={c.linkedTaskIds} onChange={(linkedTaskIds) => edit(c.id, { linkedTaskIds })} />
                </td>
                <td className={td}>
                  <select
                    value={c.status}
                    onChange={(e) => edit(c.id, { status: e.target.value as ChangeStatus })}
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[c.status]}`}
                  >
                    {CHANGE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={`${td} whitespace-nowrap text-xs`}>
                  {c.status === 'Open' ? (
                    <span className="flex gap-1">
                      <button className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40" onClick={() => decide(c, true)} disabled={readOnly}>
                        {tr('cr_approve')}
                      </button>
                      <button className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-white/15 dark:text-gray-300" onClick={() => decide(c, false)} disabled={readOnly}>
                        {tr('cr_reject')}
                      </button>
                    </span>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">
                      {c.decidedBy || '—'} · {formatDate(c.decisionDate)}
                    </span>
                  )}
                </td>
                <td className={`${td} text-right`}>
                  <button onClick={() => store.deleteItem('changes', c.id)} className={deleteBtn} title={tr('tasks_delete')} disabled={readOnly}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {changes.length === 0 && <p className="p-6 text-center text-sm text-gray-400">{tr('cr_empty')}</p>}
      </div>
    </div>
  )
}
