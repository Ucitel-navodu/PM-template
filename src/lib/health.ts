import type { Health, Settings, Task } from '../types'
import { parseDateKey } from './dates'
import { statusKind } from './status'

/**
 * Port of the original TASKS!V health formula (an Excel LET() expression).
 * Health is a computed data-quality/schedule signal, distinct from Status:
 * a task can be "In progress" and still be Red if it is behind plan.
 */

type Tolerances = Pick<Settings, 'orangeTolerance' | 'redTolerance'> & { statuses?: Settings['statuses'] }

const DEFAULT_TOLERANCES: Tolerances = { orangeTolerance: 0.1, redTolerance: 0.25 }

// Whole calendar days, DST-safe (a 23/25-hour day still counts as one).
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

// Excel's TODAY(): local midnight, no time of day.
function today(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const toDate = (key?: string) => (key ? parseDateKey(key) : null)

export function expectedProgress(currentStart?: string, currentFinish?: string): number | null {
  if (!currentStart || !currentFinish) return null
  const start = parseDateKey(currentStart)
  const finish = parseDateKey(currentFinish)
  const span = daysBetween(start, finish) + 1
  if (span <= 0) return null
  const elapsed = daysBetween(start, today()) + 1
  return Math.min(1, Math.max(0, elapsed / span))
}

export function computeHealth(task: Task, tolerances: Tolerances = DEFAULT_TOLERANCES): Health | '' {
  if (!task.name) return ''

  const now = today()
  // Custom status names are evaluated by their meaning, so the formula stays the workbook's.
  const status = statusKind(task.status, tolerances.statuses)
  const start = toDate(task.currentStart)
  const finish = toDate(task.currentFinish)
  const baselineFinish = toDate(task.baselineFinish)
  const actual = task.percentComplete
  const expected = expectedProgress(task.currentStart, task.currentFinish)
  const progressGap = actual == null || expected == null ? 0 : expected - actual

  const isDataIssue =
    (start && finish && start.getTime() > finish.getTime()) ||
    (status === 'In progress' && start && start.getTime() > now.getTime()) ||
    (status === 'Done' && (!finish || finish.getTime() > now.getTime())) ||
    (status === 'Done' && (actual == null || actual < 1)) ||
    (status === 'Not started' && actual != null && actual > 0)

  if (isDataIssue) return 'Blue'
  if (status === 'Done') return 'Green'
  if (status === 'Cancelled' || status === 'On hold') return 'Grey'
  if (!start || !finish) return 'Grey'
  if (finish.getTime() < now.getTime()) return 'Red'
  if (status === 'In progress' && progressGap > tolerances.redTolerance) return 'Red'
  if (status === 'Not started' && start.getTime() < now.getTime()) return 'Orange'
  if (
    (baselineFinish && finish.getTime() > baselineFinish.getTime()) ||
    (status === 'In progress' && progressGap > tolerances.orangeTolerance)
  ) {
    return 'Orange'
  }
  return 'Green'
}
