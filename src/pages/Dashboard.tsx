import { isScored, riskScore, scoreClass } from '../lib/raid'
import { approvedImpact } from '../lib/changes'
import { useActiveProject } from '../store/workspaceStore'
import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { leafTasks } from '../lib/schedule/tree'
import { Card, Stat } from '../components/Card'
import { MiniCalendar } from '../components/MiniCalendar'
import { ProjectInfoCard } from '../components/ProjectInfoCard'
import { computeHealth } from '../lib/health'
import { formatDate, formatMoney } from '../lib/format'
import { HEALTH_COLOR } from '../data/config'
import { milestoneAmount } from '../lib/milestones'
import type { Health } from '../types'
import { statusKind } from '../lib/status'
import { toDateKey } from '../lib/dates'

export function Dashboard() {
  const { tr, projectInfo, tasks: allTasks, milestones, budget, risks, settings } = useApp()
  const tasks = useMemo(() => leafTasks(allTasks), [allTasks])
  const changes = useActiveProject()?.changes ?? []
  const crImpact = approvedImpact(changes)

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(settings.statuses.map((s) => [s.name, 0]))
    tasks.forEach((task) => (counts[task.status] = (counts[task.status] ?? 0) + 1))
    return counts
  }, [tasks, settings.statuses])
  const isDone = (status: string) => statusKind(status, settings.statuses) === 'Done'

  const healthCounts = useMemo(() => {
    const counts: Record<Health, number> = { Green: 0, Orange: 0, Red: 0, Grey: 0, Blue: 0 }
    tasks.forEach((task) => {
      const h = computeHealth(task, settings)
      if (h) counts[h]++
    })
    return counts
  }, [tasks, settings])

  const overdueTasks = useMemo(
    () =>
      tasks.filter((task) => !isDone(task.status) && task.currentFinish && task.currentFinish < toDateKey(new Date()))
        .length,
    [tasks, settings.statuses], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const upcomingTasks = useMemo(() => {
    const now = new Date()
    return tasks
      .filter((task) => !isDone(task.status) && task.currentFinish && task.currentFinish >= toDateKey(now))
      .sort((a, b) => new Date(a.currentFinish!).getTime() - new Date(b.currentFinish!).getTime())
      .slice(0, 5)
  }, [tasks])

  const recentlyDone = useMemo(
    () =>
      tasks
        .filter((task) => isDone(task.status) && task.currentFinish)
        .sort((a, b) => new Date(b.currentFinish!).getTime() - new Date(a.currentFinish!).getTime())
        .slice(0, 5),
    [tasks],
  )

  const budgetSummary = useMemo(() => {
    const planned = budget.reduce((s, b) => s + b.planned, 0)
    const committed = budget.reduce((s, b) => s + b.committed, 0)
    const actual = budget.reduce((s, b) => s + b.actual, 0)
    const forecast = budget.reduce((s, b) => s + Math.max(b.actual, b.committed, b.planned), 0)
    return { planned, committed, actual, forecast, variance: projectInfo.budget + crImpact.cost - forecast }
  }, [budget, projectInfo.budget, crImpact.cost])

  const milestonePayments = useMemo(() => {
    const sum = (list: typeof milestones) => list.reduce((s, m) => s + milestoneAmount(m, projectInfo.budget), 0)
    return {
      total: sum(milestones),
      paid: sum(milestones.filter((m) => m.paymentStatus === 'Paid')),
      invoiced: sum(milestones.filter((m) => m.paymentStatus === 'Invoiced')),
      overdue: sum(milestones.filter((m) => m.paymentStatus === 'Overdue')),
    }
  }, [milestones, projectInfo.budget])

  // Top exposure first: open risks and issues by P x I.
  const topRisks = risks
    .filter((r) => r.status === 'Open' && isScored(r))
    .sort((a, b) => riskScore(b) - riskScore(a))
    .slice(0, 5)
  const openIssues = risks.filter((r) => r.status === 'Open' && r.type === 'Issue').length
  const openAssumptions = risks.filter((r) => r.status === 'Open' && r.type === 'Assumption' && !r.validated).length
  const pendingChanges = changes.filter((c) => c.status === 'Open')

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <ProjectInfoCard />

      <Card title={tr('dash_calendar')} icon="📅" accent="sky">
        <MiniCalendar tasks={tasks} />
      </Card>

      <Card title={tr('dash_task_status')} icon="📊" accent="slate">
        <div className="space-y-1.5">
          {Object.entries(statusCounts).map(([status, count]) => (
            <BarRow key={status} label={status} count={count} total={tasks.length} color="#6d4dfd" />
          ))}
        </div>
      </Card>

      <Card title={tr('dash_task_health')} icon="🩺" accent="violet">
        <div className="space-y-1.5">
          {(Object.keys(healthCounts) as Health[]).map((h) => (
            <BarRow key={h} label={h} count={healthCounts[h]} total={tasks.length} color={HEALTH_COLOR[h]} />
          ))}
        </div>
        <div className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600 dark:border-white/10 dark:text-gray-300">
          {tr('dash_overdue_tasks')}: <span className="font-semibold text-gray-900 dark:text-gray-50">{overdueTasks}</span>
        </div>
      </Card>

      <Card title={tr('dash_upcoming_tasks')} icon="⏭️" accent="sky">
        {upcomingTasks.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">{tr('dash_no_upcoming')}</p>
        ) : (
          <ul className="space-y-2">
            {upcomingTasks.map((task) => {
              const health = computeHealth(task, settings)
              return (
                <li key={task.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-gray-700 dark:text-gray-200" title={task.name}>
                    {task.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: health ? HEALTH_COLOR[health] : '#9ca3af' }}
                    />
                    {formatDate(task.currentFinish)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card title={tr('dash_done_tasks')} icon="✅" accent="emerald">
        {recentlyDone.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">{tr('dash_no_done')}</p>
        ) : (
          <ul className="space-y-2">
            {recentlyDone.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-gray-700 line-through decoration-gray-300 dark:text-gray-200 dark:decoration-gray-600" title={task.name}>
                  {task.name}
                </span>
                <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">{formatDate(task.currentFinish)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={tr('dash_milestones')} icon="💰" accent="amber">
        <div className="grid grid-cols-2 gap-3">
          <Stat label={tr('common_total')} value={formatMoney(milestonePayments.total, projectInfo.currency)} />
          <Stat label="Paid" value={formatMoney(milestonePayments.paid, projectInfo.currency)} />
          <Stat label="Invoiced" value={formatMoney(milestonePayments.invoiced, projectInfo.currency)} />
          <Stat label="Overdue" value={formatMoney(milestonePayments.overdue, projectInfo.currency)} />
        </div>
      </Card>

      <Card title={tr('dash_budget')} icon="💳" accent="emerald">
        <div className="grid grid-cols-2 gap-3">
          <Stat label={tr('budget_approved')} value={formatMoney(projectInfo.budget, projectInfo.currency)} />
          <Stat label={tr('budget_summary_planned')} value={formatMoney(budgetSummary.planned, projectInfo.currency)} />
          <Stat label={tr('budget_committed')} value={formatMoney(budgetSummary.committed, projectInfo.currency)} />
          <Stat label={tr('budget_actual')} value={formatMoney(budgetSummary.actual, projectInfo.currency)} />
          <Stat label={tr('budget_forecast')} value={formatMoney(budgetSummary.forecast, projectInfo.currency)} />
          <Stat
            label={tr('budget_summary_variance')}
            value={formatMoney(budgetSummary.variance, projectInfo.currency)}
          />
        </div>
      </Card>

      <Card title={tr('dash_risks')} icon="⚠️" accent="rose">
        {topRisks.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">—</p>
        ) : (
          <ul className="space-y-2">
            {topRisks.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 inline-block min-w-[1.75rem] rounded px-1 text-center text-xs font-semibold ${scoreClass(riskScore(r))}`}>{riskScore(r)}</span>
                <span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{r.id}</span>{' '}
                  <span className="text-gray-600 dark:text-gray-300">{r.title || r.description}</span>
                  {r.type === 'Issue' && <span className="ml-1 text-xs text-rose-500">(issue)</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-2 text-xs text-gray-500 dark:border-white/10 dark:text-gray-400">
          <span>
            {tr('raid_Issue')}: <b className="text-gray-800 dark:text-gray-100">{openIssues}</b>
          </span>
          <span>
            {tr('raid_Assumption')} ({tr('raid_validated').toLowerCase()} ✗): <b className="text-gray-800 dark:text-gray-100">{openAssumptions}</b>
          </span>
          <span>
            {tr('cr_open')}: <b className="text-gray-800 dark:text-gray-100">{pendingChanges.length}</b>
          </span>
        </div>
      </Card>

      <Card className="lg:col-span-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <LegendDot color={HEALTH_COLOR.Green} label="Green = OK" />
          <LegendDot color={HEALTH_COLOR.Orange} label="Orange = Warning" />
          <LegendDot color={HEALTH_COLOR.Red} label="Red = Critical" />
          <LegendDot color={HEALTH_COLOR.Grey} label="Grey = Not evaluated" />
          <LegendDot color={HEALTH_COLOR.Blue} label="Blue = Data issue" />
        </div>
      </Card>
    </div>
  )
}

function BarRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 text-gray-600 dark:text-gray-400">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-6 shrink-0 text-right font-medium text-gray-700 dark:text-gray-300">{count}</span>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
