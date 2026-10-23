import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useWorkspaceStore } from '../store/workspaceStore'
import { createBlankProject } from '../domain/workspace'
import { summarizeProject, type Rag } from '../lib/portfolio'
import { formatDate, formatMoney } from '../lib/format'
import { toDateKey } from '../lib/dates'
import { Card, Stat } from '../components/Card'
import { btnPrimary, tableWrap, tbodyRow, theadRow } from '../lib/ui'

const RAG_CLASS: Record<Rag, string> = {
  Red: 'bg-rose-500 text-white',
  Amber: 'bg-amber-400 text-gray-900',
  Green: 'bg-emerald-500 text-white',
  Grey: 'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-100',
}

export function PortfolioPage({ onOpenProject }: { onOpenProject: () => void }) {
  const { tr, readOnly } = useApp()
  const workspace = useWorkspaceStore((s) => s.workspace)
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId)
  const store = useWorkspaceStore.getState()
  const [showArchived, setShowArchived] = useState(false)

  const rows = useMemo(
    () =>
      workspace.projects
        .filter((p) => showArchived || !p.archived)
        .map((p) => ({ p, s: summarizeProject(p, workspace.calendar) })),
    [workspace, showArchived],
  )

  const totals = useMemo(() => {
    const in30 = toDateKey(new Date(Date.now() + 30 * 86_400_000))
    const active = rows.filter((r) => !r.p.archived)
    return {
      count: active.length,
      red: active.filter((r) => r.s.rag === 'Red').length,
      amber: active.filter((r) => r.s.rag === 'Amber').length,
      green: active.filter((r) => r.s.rag === 'Green').length,
      overdue: active.reduce((n, r) => n + r.s.overdueTasks, 0),
      milestones30: active.filter((r) => r.s.nextMilestone && (r.s.nextMilestone.plannedDate ?? '') <= in30).length,
    }
  }, [rows])

  const newProject = () => {
    const name = window.prompt(tr('portfolio_new_prompt'))?.trim()
    if (!name) return
    const active = workspace.projects.find((p) => p.id === activeProjectId)
    const lists = active && window.confirm(tr('portfolio_new_from')) ? active.lists : undefined
    store.addProject(createBlankProject(name, lists))
    onOpenProject()
  }

  const open = (id: string) => {
    store.setActiveProject(id)
    onOpenProject()
  }

  const action = 'rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{tr('portfolio_title')}</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            {tr('portfolio_show_archived')}
          </label>
          <button onClick={newProject} className={btnPrimary} disabled={readOnly}>
            {tr('portfolio_new')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <Stat label={tr('portfolio_projects')} value={totals.count} />
        </Card>
        <Card>
          <div className="text-xs text-gray-500 dark:text-gray-400" title={tr('portfolio_rag_help')}>
            {tr('portfolio_rag')} ⓘ
          </div>
          <div className="mt-1 flex gap-2 text-sm font-semibold">
            <span className={`rounded px-2 py-0.5 ${RAG_CLASS.Red}`}>{totals.red}</span>
            <span className={`rounded px-2 py-0.5 ${RAG_CLASS.Amber}`}>{totals.amber}</span>
            <span className={`rounded px-2 py-0.5 ${RAG_CLASS.Green}`}>{totals.green}</span>
          </div>
        </Card>
        <Card>
          <Stat label={tr('portfolio_overdue')} value={totals.overdue} />
        </Card>
        <Card>
          <Stat label={tr('portfolio_upcoming_milestones')} value={totals.milestones30} />
        </Card>
      </div>

      <div className={tableWrap}>
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className={theadRow}>
              <th className="px-3 py-2">{tr('portfolio_rag')}</th>
              <th className="px-3 py-2">{tr('dash_project_name')}</th>
              <th className="px-3 py-2">ITPM</th>
              <th className="px-3 py-2">{tr('portfolio_progress')}</th>
              <th className="px-3 py-2">{tr('portfolio_tasks_health')}</th>
              <th className="px-3 py-2">{tr('portfolio_next_milestone')}</th>
              <th className="px-3 py-2">{tr('portfolio_open_risks')}</th>
              <th className="px-3 py-2">{tr('portfolio_budget_used')}</th>
              <th className="px-3 py-2">{tr('portfolio_finish')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, s }) => (
              <tr key={p.id} className={`${tbodyRow} ${p.archived ? 'opacity-50' : ''} ${p.id === activeProjectId ? 'bg-brand-50/60 dark:bg-brand-500/10' : ''}`}>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${RAG_CLASS[s.rag]}`}
                    title={s.ragReasons.join('\n') || undefined}
                  >
                    {s.rag}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => open(p.id)} className="text-left font-medium text-gray-900 hover:text-brand-600 dark:text-gray-100 dark:hover:text-brand-300">
                    {p.info.projectName}
                  </button>
                  {p.info.projectId && <div className="text-xs text-gray-400">{p.info.projectId}</div>}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{p.info.itpm || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round(s.progress * 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{Math.round(s.progress * 100)} %</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  <span className="text-emerald-600">●{s.health.Green}</span>{' '}
                  <span className="text-amber-500">●{s.health.Orange}</span>{' '}
                  <span className="text-rose-600">●{s.health.Red}</span>{' '}
                  <span className="text-blue-600">●{s.health.Blue}</span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                  {s.nextMilestone ? `${s.nextMilestone.name} · ${formatDate(s.nextMilestone.plannedDate)}` : '—'}
                </td>
                <td className="px-3 py-2 text-xs">
                  {s.openRisks}
                  {s.highRisks > 0 && <span className="ml-1 rounded bg-rose-50 px-1 text-rose-600 dark:bg-rose-500/15">{s.highRisks}× {tr('portfolio_high')}</span>}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                  {s.budgetUsedPct === null ? '—' : `${Math.round(s.budgetUsedPct * 100)} % ${tr('portfolio_of')} ${formatMoney(p.info.budget, p.info.currency)}`}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{formatDate(s.finish) || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button className={action} onClick={() => open(p.id)}>
                    {tr('portfolio_open')}
                  </button>
                  <button className={action} onClick={() => store.duplicateProject(p.id)} disabled={readOnly}>
                    {tr('portfolio_duplicate')}
                  </button>
                  <button className={action} onClick={() => store.setProjectArchived(p.id, !p.archived)} disabled={readOnly}>
                    {p.archived ? tr('portfolio_unarchive') : tr('portfolio_archive')}
                  </button>
                  <button
                    className={`${action} hover:text-rose-600`}
                    disabled={readOnly}
                    onClick={() =>
                      window.confirm(tr('portfolio_delete_confirm').replace('{name}', p.info.projectName)) && store.deleteProject(p.id)
                    }
                  >
                    {tr('portfolio_delete')}
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
