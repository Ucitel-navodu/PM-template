import { approvedImpact } from './changes'
import { leafTasks } from './schedule/tree'
import { statusKind } from './status'
import type { CalendarSettings, Health, Milestone, Project } from '../types'
import { computeHealth } from './health'
import { toDateKey } from './dates'

export type Rag = 'Red' | 'Amber' | 'Green' | 'Grey'

export interface ProjectSummary {
  rag: Rag
  ragReasons: string[]
  progress: number // 0..1, duration-weighted
  health: Record<Health, number>
  overdueTasks: number
  nextMilestone?: Milestone
  openRisks: number
  openIssues: number
  highRisks: number
  pendingChanges: number
  budgetForecast: number
  budgetUsedPct: number | null
  finish?: string
}

const LEVEL: Record<string, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 }
const RAG_ORDER: Rag[] = ['Grey', 'Green', 'Amber', 'Red']
const worse = (a: Rag, b: Rag): Rag => (RAG_ORDER.indexOf(a) >= RAG_ORDER.indexOf(b) ? a : b)

function durationDays(start?: string, finish?: string): number {
  if (!start || !finish) return 1
  return Math.max(1, (new Date(finish).getTime() - new Date(start).getTime()) / 86_400_000 + 1)
}

const REASONS = {
  CZ: { red: 'úkolů s Health Red', orange: 'úkolů Orange/Blue', budget: 'prognóza nad schváleným rozpočtem', milestone: 'milníků po termínu', risk: 'vysokých rizik' },
  EN: { red: 'Red health', orange: 'Orange/Blue health', budget: 'forecast > approved budget', milestone: 'overdue milestone', risk: 'high risk' },
}

export function summarizeProject(p: Project, calendar: CalendarSettings, today = new Date(), lang: 'CZ' | 'EN' = 'EN'): ProjectSummary {
  const R = REASONS[lang]
  const todayKey = toDateKey(today)
  const leaves = leafTasks(p.tasks)
  const health: Record<Health, number> = { Green: 0, Orange: 0, Red: 0, Grey: 0, Blue: 0 }
  let weighted = 0
  let weights = 0
  let overdueTasks = 0
  for (const t of leaves) {
    const h = computeHealth(t, { ...calendar, statuses: p.lists.statuses })
    if (h) health[h]++
    const kind = statusKind(t.status, p.lists.statuses)
    if (kind === 'Cancelled') continue
    const w = durationDays(t.currentStart, t.currentFinish)
    weighted += (kind === 'Done' ? 1 : (t.percentComplete ?? 0)) * w
    weights += w
    if (kind !== 'Done' && t.currentFinish && t.currentFinish.slice(0, 10) < todayKey) overdueTasks++
  }

  const openMilestones = p.milestones
    .filter((m) => !m.actualDate && m.plannedDate)
    .sort((a, b) => (a.plannedDate ?? '').localeCompare(b.plannedDate ?? ''))
  const overdueMilestones = openMilestones.filter((m) => (m.plannedDate ?? '') < todayKey)
  const nextMilestone = openMilestones.find((m) => (m.plannedDate ?? '') >= todayKey)

  // RAID: only risks and issues carry a P x I exposure; assumptions etc. are tracked, not scored.
  const openRaid = p.risks.filter((r) => r.status === 'Open')
  const openRisks = openRaid.filter((r) => (r.type ?? 'Risk') === 'Risk')
  const openIssues = openRaid.filter((r) => r.type === 'Issue').length
  const pendingChanges = (p.changes ?? []).filter((c) => c.status === 'Open').length
  const highRisks = openRaid.filter((r) => r.type === 'Risk' || r.type === 'Issue').filter((r) => (LEVEL[r.probability] ?? 0) * (LEVEL[r.impact] ?? 0) >= 9).length

  const budgetForecast = p.budget.reduce((s, b) => s + Math.max(b.actual, b.committed, b.planned), 0)
  const actual = p.budget.reduce((s, b) => s + b.actual, 0)
  const approved = p.info.budget + approvedImpact(p.changes).cost

  let rag: Rag = leaves.length ? 'Green' : 'Grey'
  const ragReasons: string[] = []
  if (health.Red) {
    rag = worse(rag, 'Red')
    ragReasons.push(`${health.Red}× ${R.red}`)
  } else if (health.Orange || health.Blue) {
    rag = worse(rag, 'Amber')
    ragReasons.push(`${health.Orange + health.Blue}× ${R.orange}`)
  }
  if (approved > 0 && budgetForecast > approved) {
    rag = worse(rag, 'Red')
    ragReasons.push(R.budget)
  }
  if (overdueMilestones.length) {
    rag = worse(rag, 'Red')
    ragReasons.push(`${overdueMilestones.length}× ${R.milestone}`)
  }
  if (highRisks) {
    rag = worse(rag, 'Amber')
    ragReasons.push(`${highRisks}× ${R.risk}`)
  }

  const finish = p.tasks
    .map((t) => t.currentFinish)
    .filter(Boolean)
    .sort()
    .at(-1)

  return {
    rag,
    ragReasons,
    progress: weights ? weighted / weights : 0,
    health,
    overdueTasks,
    nextMilestone,
    openRisks: openRisks.length,
    openIssues,
    highRisks,
    pendingChanges,
    budgetForecast,
    budgetUsedPct: approved > 0 ? actual / approved : null,
    finish: finish ?? (p.info.plannedFinish || undefined),
  }
}
