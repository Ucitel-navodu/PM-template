import type { CalendarSettings, LinkType, Project, Task } from '../../types'
import { WorkCalendar, calendarOrigin } from './calendar'
import { outline } from './tree'

/*
 * Critical Path Method scheduler (forward/backward pass), working-day based.
 *
 * Times are working-day ordinals (see WorkCalendar). A task occupies
 * [es, ef) with ef = es + duration; a milestone (duration 0) sits at the end
 * of the day before `es`, so a milestone linked FS after a task finishing on
 * Friday is shown on that Friday, and its FS successor starts on Monday -
 * the same convention as MS Project.
 *
 * - auto tasks start as early as the project start, constraint and
 *   predecessors allow (FS/SS/FF/SF with lag, negative lag = lead);
 * - manual tasks keep their dates, but still drive their successors;
 * - tasks that already started (In progress / Done) keep their actual start;
 * - cancelled tasks keep their dates and drive nothing;
 * - links to or from a summary task apply to all of its leaf tasks;
 * - summary tasks roll up the dates, % complete and float of their children.
 */

export interface ScheduledTask {
  start?: string
  finish?: string
  duration: number
  es: number
  ef: number
  totalFloat: number
  freeFloat: number
  critical: boolean
  summary: boolean
}

export interface ScheduleResult {
  tasks: Map<string, ScheduledTask>
  /** Tasks that are part of a dependency cycle (scheduled as if unlinked). */
  cycle: string[]
  finish?: string
}

interface Edge {
  pred: string
  succ: string
  type: LinkType
  lag: number
}

const STARTED = new Set(['In progress', 'Done', 'On hold', 'Delayed'])

function taskDuration(t: Task, cal: WorkCalendar): number {
  if (t.milestone) return 0
  if (t.duration !== undefined && t.duration >= 0 && (t.schedulingMode === 'auto' || !t.currentStart || !t.currentFinish)) {
    return Math.round(t.duration)
  }
  if (t.currentStart && t.currentFinish) return Math.max(1, cal.workdaysBetween(t.currentStart, t.currentFinish))
  return Math.max(0, Math.round(t.duration ?? 1))
}

export function schedule(tasks: Task[], calendar: Pick<CalendarSettings, 'workingDays' | 'holidays'>, projectStart?: string): ScheduleResult {
  const cal = new WorkCalendar(
    calendar,
    calendarOrigin([projectStart, ...tasks.flatMap((t) => [t.currentStart, t.constraint?.date])]),
  )
  const tree = outline(tasks)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const leaves = tasks.filter((t) => !tree.get(t.id)!.isSummary)

  const leafIdsUnder = (id: string): string[] => {
    const node = tree.get(id)
    if (!node || !node.isSummary) return [id]
    return node.childIds.flatMap(leafIdsUnder)
  }

  // --- durations, fixed starts --------------------------------------------
  const dur = new Map<string, number>()
  const fixedEs = new Map<string, number>()
  for (const t of leaves) {
    const d = taskDuration(t, cal)
    dur.set(t.id, d)
    const m = d === 0 ? 1 : 0
    const pinned =
      t.currentStart && (t.schedulingMode === 'manual' || t.status === 'Cancelled' || (STARTED.has(t.status) && (t.percentComplete ?? 0) > 0) || t.status === 'Done')
    if (pinned) fixedEs.set(t.id, cal.ordinal(t.currentStart!) + m)
  }
  const inactive = (id: string) => byId.get(id)?.status === 'Cancelled'

  // --- links expanded to leaves -----------------------------------------
  const edges: Edge[] = []
  for (const t of tasks) {
    for (const dep of t.dependencies ?? []) {
      if (!byId.has(dep.predId) || inactive(dep.predId)) continue
      for (const pred of leafIdsUnder(dep.predId)) {
        if (inactive(pred)) continue
        for (const succ of leafIdsUnder(t.id)) {
          if (pred !== succ) edges.push({ pred, succ, type: dep.type, lag: Math.round(dep.lag || 0) })
        }
      }
    }
  }
  const incoming = new Map<string, Edge[]>(leaves.map((t) => [t.id, []]))
  const outgoing = new Map<string, Edge[]>(leaves.map((t) => [t.id, []]))
  for (const e of edges) {
    incoming.get(e.succ)?.push(e)
    outgoing.get(e.pred)?.push(e)
  }

  // --- topological order (Kahn); leftovers are in a cycle ---------------
  const indeg = new Map(leaves.map((t) => [t.id, incoming.get(t.id)!.length]))
  const queue = leaves.filter((t) => indeg.get(t.id) === 0).map((t) => t.id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const e of outgoing.get(id)!) {
      const n = indeg.get(e.succ)! - 1
      indeg.set(e.succ, n)
      if (n === 0) queue.push(e.succ)
    }
  }
  const cycle = leaves.map((t) => t.id).filter((id) => !order.includes(id))
  const cyclic = new Set(cycle)
  order.push(...cycle)

  // --- forward pass --------------------------------------------------------
  const startOrd = projectStart ? cal.ordinal(projectStart) : undefined
  const es = new Map<string, number>()
  const ef = new Map<string, number>()
  for (const id of order) {
    const t = byId.get(id)!
    const d = dur.get(id)!
    const m = d === 0 ? 1 : 0
    let start: number
    if (fixedEs.has(id)) {
      start = fixedEs.get(id)!
    } else if (t.constraint?.type === 'MSO' && t.constraint.date) {
      start = cal.ordinal(t.constraint.date) + m
    } else {
      start = startOrd !== undefined ? startOrd + m : t.currentStart ? cal.ordinal(t.currentStart) + m : 0
      if (t.constraint?.type === 'SNET' && t.constraint.date) start = Math.max(start, cal.ordinal(t.constraint.date) + m)
      if (!cyclic.has(id)) {
        for (const e of incoming.get(id)!) {
          const pES = es.get(e.pred)!
          const pEF = ef.get(e.pred)!
          const bound =
            e.type === 'FS' ? pEF + e.lag : e.type === 'SS' ? pES + e.lag : e.type === 'FF' ? pEF + e.lag - d : pES + e.lag - d
          start = Math.max(start, bound)
        }
      }
    }
    es.set(id, start)
    ef.set(id, start + d)
  }

  // --- backward pass ---------------------------------------------------------
  const active = leaves.filter((t) => !inactive(t.id))
  const projectEnd = active.length ? Math.max(...active.map((t) => ef.get(t.id)!)) : 0
  const lf = new Map<string, number>()
  const free = new Map<string, number>()
  for (const id of [...order].reverse()) {
    const d = dur.get(id)!
    let late = projectEnd
    let ff = projectEnd - ef.get(id)!
    for (const e of cyclic.has(id) ? [] : outgoing.get(id)!) {
      if (cyclic.has(e.succ)) continue
      const sLS = lf.get(e.succ)! - dur.get(e.succ)!
      const sLF = lf.get(e.succ)!
      const bound = e.type === 'FS' ? sLS - e.lag : e.type === 'SS' ? sLS - e.lag + d : e.type === 'FF' ? sLF - e.lag : sLF - e.lag + d
      late = Math.min(late, bound)
      const sES = es.get(e.succ)!
      const sEF = ef.get(e.succ)!
      const slack =
        e.type === 'FS'
          ? sES - (ef.get(id)! + e.lag)
          : e.type === 'SS'
            ? sES - (es.get(id)! + e.lag)
            : e.type === 'FF'
              ? sEF - (ef.get(id)! + e.lag)
              : sEF - (es.get(id)! + e.lag)
      ff = Math.min(ff, slack)
    }
    lf.set(id, late)
    free.set(id, Math.max(0, ff))
  }

  // --- results -------------------------------------------------------------
  const result = new Map<string, ScheduledTask>()
  for (const t of leaves) {
    const id = t.id
    const d = dur.get(id)!
    const s = es.get(id)!
    const f = ef.get(id)!
    const totalFloat = lf.get(id)! - d - s
    const manualDates = t.schedulingMode === 'manual' && t.currentStart && t.currentFinish
    result.set(id, {
      start: manualDates ? t.currentStart : d === 0 ? cal.date(s - 1) : cal.date(s),
      finish: manualDates ? t.currentFinish : d === 0 ? cal.date(s - 1) : cal.date(f - 1),
      duration: d,
      es: s,
      ef: f,
      totalFloat,
      freeFloat: free.get(id)!,
      critical: !inactive(id) && t.status !== 'Done' && totalFloat <= 0,
      summary: false,
    })
  }
  // Summaries: children come after their parent, so walk backwards.
  for (let i = tasks.length - 1; i >= 0; i--) {
    const t = tasks[i]
    const node = tree.get(t.id)!
    if (!node.isSummary) continue
    const kids = node.childIds.map((c) => result.get(c)!).filter(Boolean)
    const dated = kids.filter((k) => k.start && k.finish)
    const start = dated.map((k) => k.start!).sort()[0]
    const finish = dated.map((k) => k.finish!).sort().at(-1)
    const s = Math.min(...kids.map((k) => k.es))
    const f = Math.max(...kids.map((k) => k.ef))
    result.set(t.id, {
      start,
      finish,
      duration: start && finish ? cal.workdaysBetween(start, finish) : 0,
      es: s,
      ef: f,
      totalFloat: Math.min(...kids.map((k) => k.totalFloat)),
      freeFloat: 0,
      critical: kids.some((k) => k.critical),
      summary: true,
    })
  }

  return { tasks: result, cycle, finish: active.length ? cal.date(projectEnd - 1) : undefined }
}

/** Duration-weighted % complete of a summary's leaf tasks (milestones count as 1 day). */
function rollupPercent(tasks: Task[], ids: string[], res: ScheduleResult): number | null {
  let total = 0
  let done = 0
  for (const id of ids) {
    const t = tasks.find((x) => x.id === id)!
    if (t.status === 'Cancelled') continue
    const w = Math.max(1, res.tasks.get(id)?.duration ?? 1)
    total += w
    done += w * (t.percentComplete ?? 0)
  }
  return total ? Math.round((done / total) * 1000) / 1000 : null
}

/**
 * Write the schedule back into the tasks: dates of auto tasks and summaries,
 * outline numbers, durations, summary % complete. Returns the same project
 * object when nothing changed (keeps undo history and autosave quiet).
 */
export function applySchedule(project: Project, calendar: Pick<CalendarSettings, 'workingDays' | 'holidays'>): Project {
  const res = schedule(project.tasks, calendar, project.info.start || undefined)
  const tree = outline(project.tasks)
  const leavesUnder = (id: string): string[] => {
    const n = tree.get(id)!
    return n.isSummary ? n.childIds.flatMap(leavesUnder) : [id]
  }
  const cyclic = new Set(res.cycle)
  let changed = false
  const tasks = project.tasks.map((t) => {
    const s = res.tasks.get(t.id)!
    const node = tree.get(t.id)!
    const patch: Partial<Task> = {}
    if (t.wbs !== node.wbs) patch.wbs = node.wbs
    if (t.outlineLevel !== (node.wbs.split('.').length)) patch.outlineLevel = node.wbs.split('.').length
    if (node.isSummary) {
      if (s.start !== t.currentStart) patch.currentStart = s.start
      if (s.finish !== t.currentFinish) patch.currentFinish = s.finish
      if (t.duration !== s.duration) patch.duration = s.duration
      const pct = rollupPercent(project.tasks, leavesUnder(t.id), res)
      if (pct !== t.percentComplete) patch.percentComplete = pct
      if (t.milestone) patch.milestone = false
    } else {
      if (t.duration !== s.duration) patch.duration = s.duration
      if (t.schedulingMode === 'auto' && !cyclic.has(t.id)) {
        if (s.start !== t.currentStart) patch.currentStart = s.start
        if (s.finish !== t.currentFinish) patch.currentFinish = s.finish
      }
    }
    if (Object.keys(patch).length === 0) return t
    changed = true
    return { ...t, ...patch }
  })
  return changed ? { ...project, tasks } : project
}
