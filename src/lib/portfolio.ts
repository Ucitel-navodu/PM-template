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
  highRisks: number
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

export function summarizeProject(p: Project, calendar: CalendarSettings, today = new Date()): ProjectSummary {
  const todayKey = toDateKey(today)
  const health: Record<Health, number> = { Green: 0, Orange: 0, Red: 0, Grey: 0, Blue: 0 }
  let weighted = 0
  let weights = 0
  let overdueTasks = 0
  for (const t of p.tasks) {
    const h = computeHealth(t, calendar)
    if (h) health[h]++
    if (t.status === 'Cancelled') continue
    const w = durationDays(t.currentStart, t.currentFinish)
    weighted += (t.status === 'Done' ? 1 : (t.percentComplete ?? 0)) * w
    weights += w
    if (t.status !== 'Done' && t.currentFinish && t.currentFinish.slice(0, 10) < todayKey) overdueTasks++
  }

  const openMilestones = p.milestones
    .filter((m) => !m.actualDate && m.plannedDate)
    .sort((a, b) => (a.plannedDate ?? '').localeCompare(b.plannedDate ?? ''))
  const overdueMilestones = openMilestones.filter((m) => (m.plannedDate ?? '') < todayKey)
  const nextMilestone = openMilestones.find((m) => (m.plannedDate ?? '') >= todayKey)

  const openRisks = p.risks.filter((r) => r.status === 'Open')
  const highRisks = openRisks.filter((r) => (LEVEL[r.probability] ?? 0) * (LEVEL[r.impact] ?? 0) >= 9).length

  const budgetForecast = p.budget.reduce((s, b) => s + Math.max(b.actual, b.committed, b.planned), 0)
  const actual = p.budget.reduce((s, b) => s + b.actual, 0)
  const approved = p.info.budget

  let rag: Rag = p.tasks.length ? 'Green' : 'Grey'
  const ragReasons: string[] = []
  if (health.Red) {
    rag = worse(rag, 'Red')
    ragReasons.push(`${health.Red}× Red health`)
  } else if (health.Orange || health.Blue) {
    rag = worse(rag, 'Amber')
    ragReasons.push(`${health.Orange + health.Blue}× Orange/Blue health`)
  }
  if (approved > 0 && budgetForecast > approved) {
    rag = worse(rag, 'Red')
    ragReasons.push('forecast > approved budget')
  }
  if (overdueMilestones.length) {
    rag = worse(rag, 'Red')
    ragReasons.push(`${overdueMilestones.length}× overdue milestone`)
  }
  if (highRisks) {
    rag = worse(rag, 'Amber')
    ragReasons.push(`${highRisks}× high risk`)
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
    highRisks,
    budgetForecast,
    budgetUsedPct: approved > 0 ? actual / approved : null,
    finish: finish ?? (p.info.plannedFinish || undefined),
  }
}
