import type { CalendarSettings, ChangeRequest, Health, Milestone, Project, Risk, Task } from '../types'
import { summarizeProject, type ProjectSummary } from './portfolio'
import { approvedImpact } from './changes'
import { isScored, riskScore } from './raid'
import { statusKind } from './status'
import { computeHealth } from './health'
import { leafTasks } from './schedule/tree'
import { WorkCalendar } from './schedule/calendar'
import { parseDateKey, toDateKey } from './dates'
import { formatDate } from './format'

/*
 * Content of a status report / SteCo deck, computed from the project data
 * for a reporting period. Pure: the same data gives the same report, which
 * keeps printed, PowerPoint and saved reports consistent.
 */

export interface ReportOptions {
  from: string // period start (inclusive)
  to: string // period end = report date (inclusive)
  today?: Date
  lang?: 'CZ' | 'EN'
}

export interface StatusReportData {
  project: Project
  period: { from: string; to: string; nextTo: string }
  summary: ProjectSummary
  finish?: string
  baselineFinish?: string
  /** Scheduled finish vs. primary baseline finish in working days (+ = late). */
  finishVariance: number | null
  budget: { approved: number; changes: number; current: number; planned: number; committed: number; actual: number; forecast: number; variance: number }
  health: Record<Health, number>
  done: Task[]
  next: Task[]
  late: { task: Task; days: number }[]
  milestones: { overdue: Milestone[]; upcoming: Milestone[] }
  risks: Risk[]
  decisions: Risk[]
  changes: { open: ChangeRequest[]; decided: ChangeRequest[] }
  texts: { achievements: string; nextSteps: string; escalations: string }
}

const within = (d: string | undefined, from: string, to: string) => Boolean(d) && d!.slice(0, 10) >= from && d!.slice(0, 10) <= to

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key)
  return toDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days))
}

export function buildStatusReport(project: Project, calendar: CalendarSettings, opts: ReportOptions): StatusReportData {
  const today = opts.today ?? parseDateKey(opts.to)
  const { from, to } = opts
  const periodDays = Math.max(1, Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86_400_000))
  const nextTo = addDays(to, periodDays)
  const statuses = project.lists.statuses
  const kind = (t: Task) => statusKind(t.status, statuses)
  const leaves = leafTasks(project.tasks)
  const cal = new WorkCalendar(calendar, '2000-01-01')
  const summary = summarizeProject(project, calendar, today, opts.lang ?? 'CZ')

  const health: Record<Health, number> = { Green: 0, Orange: 0, Red: 0, Grey: 0, Blue: 0 }
  for (const t of leaves) {
    const h = computeHealth(t, { ...calendar, statuses })
    if (h) health[h]++
  }

  const done = leaves
    .filter((t) => kind(t) === 'Done' && within(t.currentFinish, from, to))
    .sort((a, b) => (a.currentFinish ?? '').localeCompare(b.currentFinish ?? ''))
  const next = leaves
    .filter((t) => !['Done', 'Cancelled'].includes(kind(t)))
    // Open work that has started (overdue included) or starts in the next period.
    .filter((t) => Boolean(t.currentStart) && t.currentStart! <= nextTo)
    .sort((a, b) => (a.currentFinish ?? '').localeCompare(b.currentFinish ?? ''))

  const slip = (t: Task) => {
    if (!t.baselineFinish || !t.currentFinish || t.currentFinish <= t.baselineFinish) return 0
    return cal.workdaysBetween(t.baselineFinish, t.currentFinish) - (cal.isWorkingDay(t.baselineFinish) ? 1 : 0)
  }
  const late = leaves
    .filter((t) => kind(t) !== 'Cancelled')
    .map((task) => ({ task, days: slip(task) }))
    .filter((x) => x.days > 0)
    .sort((a, b) => b.days - a.days)
    .slice(0, 10)

  const finish = leaves.map((t) => t.currentFinish).filter(Boolean).sort().at(-1)
  const baselineFinish = leaves.map((t) => t.baselineFinish).filter(Boolean).sort().at(-1)
  let finishVariance: number | null = null
  if (finish && baselineFinish) {
    finishVariance =
      finish === baselineFinish
        ? 0
        : finish > baselineFinish
          ? cal.workdaysBetween(baselineFinish, finish) - (cal.isWorkingDay(baselineFinish) ? 1 : 0)
          : -(cal.workdaysBetween(finish, baselineFinish) - (cal.isWorkingDay(finish) ? 1 : 0))
  }

  const cr = approvedImpact(project.changes)
  const sum = (k: 'planned' | 'committed' | 'actual') => project.budget.reduce((a, b) => a + (b[k] || 0), 0)
  const forecast = project.budget.reduce((a, b) => a + Math.max(b.actual, b.committed, b.planned), 0)
  const current = project.info.budget + cr.cost
  const budget = {
    approved: project.info.budget,
    changes: cr.cost,
    current,
    planned: sum('planned'),
    committed: sum('committed'),
    actual: sum('actual'),
    forecast,
    variance: current - forecast,
  }

  const todayKey = toDateKey(today)
  const openMilestones = project.milestones.filter((m) => !m.actualDate && m.plannedDate && m.paymentStatus !== 'Cancelled')
  const milestones = {
    overdue: openMilestones.filter((m) => m.plannedDate! < todayKey).sort((a, b) => a.plannedDate!.localeCompare(b.plannedDate!)),
    upcoming: openMilestones
      .filter((m) => m.plannedDate! >= todayKey)
      .sort((a, b) => a.plannedDate!.localeCompare(b.plannedDate!))
      .slice(0, 5),
  }

  const risks = project.risks
    .filter((r) => r.status === 'Open' && isScored(r))
    .sort((a, b) => riskScore(b) - riskScore(a))
    .slice(0, 6)
  const decisions = project.risks.filter((r) => r.type === 'Decision' && within(r.decisionDate, from, to))
  const changes = {
    open: project.changes.filter((c) => c.status === 'Open'),
    decided: project.changes.filter((c) => c.status !== 'Open' && within(c.decisionDate, from, to)),
  }

  // Suggested commentary - the PM edits it before saving / presenting.
  const line = (t: Task) => `• ${t.name} (${formatDate(t.currentFinish)})`
  const texts = {
    achievements: done.map(line).join('\n'),
    nextSteps: next.slice(0, 8).map(line).join('\n'),
    escalations: [
      ...changes.open.map((c) => `• ${c.id} ${c.title} – ${opts.lang === 'EN' ? 'change decision needed' : 'rozhodnutí o změně'} (${c.impactDays} ${opts.lang === 'EN' ? 'wd' : 'pd'}, ${c.impactCost.toLocaleString('cs-CZ')} ${project.info.currency})`),
      ...risks.filter((r) => riskScore(r) >= 9).map((r) => `• ${r.id} ${r.title || r.description}`),
    ].join('\n'),
  }

  return { project, period: { from, to, nextTo }, summary, finish, baselineFinish, finishVariance, budget, health, done, next, late, milestones, risks, decisions, changes, texts }
}

/** Default period: since the last saved report, otherwise the last 14 days. */
export function defaultPeriod(project: Project, today = new Date()): { from: string; to: string } {
  const to = toDateKey(today)
  const last = [...project.statusReports].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  return { from: last && last.date < to ? addDays(last.date, 1) : addDays(to, -13), to }
}

// --- Management roadmap (replacement of the workbook's RoadMap.bas) --------

export interface RoadmapItem {
  id: string
  name: string
  start: string
  finish: string
  milestone: boolean
  health: Health | ''
  phase: string
}

export interface Roadmap {
  lanes: { name: string; items: RoadmapItem[] }[]
  start: string
  end: string
}

/**
 * Tasks flagged "Mgmt export" in their "Mgmt order" (as the VBA roadmap did),
 * grouped into swimlanes. Without any flagged task, the top-level tasks and
 * all milestones are used so the roadmap is never empty.
 */
export function buildRoadmap(project: Project, calendar: CalendarSettings, groupBy: 'phase' | 'area' = 'phase'): Roadmap {
  const dated = project.tasks.filter((t) => t.currentStart && t.currentFinish)
  let picked = dated.filter((t) => t.mgmtExport)
  if (picked.length === 0) picked = dated.filter((t) => t.outlineLevel === 1 || t.milestone)
  picked = [...picked].sort((a, b) => (a.mgmtOrder ?? 1e9) - (b.mgmtOrder ?? 1e9) || a.currentStart!.localeCompare(b.currentStart!))

  const key = (t: Task) => (groupBy === 'phase' ? t.phase : t.projectArea) || '—'
  const order = groupBy === 'phase' ? project.lists.phases : project.lists.projectAreas
  const names = [...new Set(picked.map(key))].sort((a, b) => {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib)
  })
  const lanes = names.map((name) => ({
    name,
    items: picked
      .filter((t) => key(t) === name)
      .map((t) => ({
        id: t.id,
        name: t.name,
        start: t.currentStart!,
        finish: t.currentFinish!,
        milestone: t.milestone,
        health: computeHealth(t, { ...calendar, statuses: project.lists.statuses }),
        phase: t.phase,
      })),
  }))
  const all = picked.flatMap((t) => [t.currentStart!, t.currentFinish!]).sort()
  return { lanes, start: all[0] ?? toDateKey(new Date()), end: all.at(-1) ?? toDateKey(new Date()) }
}
