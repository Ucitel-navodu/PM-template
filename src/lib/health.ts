import type { Health, Task } from '../types'

/**
 * Port of the original TASKS!V health formula (an Excel LET() expression).
 * Health is a computed data-quality/schedule signal, distinct from Status:
 * a task can be "In progress" and still be Red if it is behind plan.
 */

const ORANGE_TOLERANCE = 0.1
const RED_TOLERANCE = 0.25

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86400000
}

export function expectedProgress(currentStart?: string, currentFinish?: string): number | null {
  if (!currentStart || !currentFinish) return null
  const start = new Date(currentStart)
  const finish = new Date(currentFinish)
  const today = new Date()
  const span = daysBetween(start, finish) + 1
  if (span <= 0) return null
  const elapsed = daysBetween(start, today) + 1
  return Math.min(1, Math.max(0, elapsed / span))
}

export function computeHealth(task: Task): Health | '' {
  if (!task.name) return ''

  const today = new Date()
  const start = task.currentStart ? new Date(task.currentStart) : null
  const finish = task.currentFinish ? new Date(task.currentFinish) : null
  const baselineFinish = task.baselineFinish ? new Date(task.baselineFinish) : null
  const actual = task.percentComplete
  const expected = expectedProgress(task.currentStart, task.currentFinish)
  const progressGap = actual == null || expected == null ? 0 : expected - actual

  const isDataIssue =
    (start && finish && start.getTime() > finish.getTime()) ||
    (task.status === 'In progress' && start && start.getTime() > today.getTime()) ||
    (task.status === 'Done' && (!finish || finish.getTime() > today.getTime())) ||
    (task.status === 'Done' && (actual == null || actual < 1)) ||
    (task.status === 'Not started' && actual != null && actual > 0)

  if (isDataIssue) return 'Blue'
  if (task.status === 'Done') return 'Green'
  if (task.status === 'Cancelled' || task.status === 'On hold') return 'Grey'
  if (!start || !finish) return 'Grey'
  if (finish.getTime() < today.getTime()) return 'Red'
  if (task.status === 'In progress' && progressGap > RED_TOLERANCE) return 'Red'
  if (task.status === 'Not started' && start.getTime() < today.getTime()) return 'Orange'
  if (
    (baselineFinish && finish.getTime() > baselineFinish.getTime()) ||
    (task.status === 'In progress' && progressGap > ORANGE_TOLERANCE)
  ) {
    return 'Orange'
  }
  return 'Green'
}
