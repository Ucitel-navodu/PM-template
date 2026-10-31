import type { Dependency, ImportRecord, LinkType, Project, Task } from '../../types'
import { newId } from '../../domain/workspace'
import { statusKind, statusOfKind } from '../status'
import type { MspProject } from './msp'

/*
 * Import planner shared by MS Project XML, Excel and CSV: it turns imported
 * tasks into a *plan* (added / changed / unchanged / removed) which the user
 * reviews before anything is written. Applying a plan is a pure function too,
 * so the store only has to swap the project (one undo step).
 *
 * Ownership of fields on a repeated import:
 *  - the file owns structure and schedule: name, level, dates, duration, % complete,
 *    milestone flag, links, baseline (optional), constraint;
 *  - the app owns the PM's own data: phase, area, priority, notes, Mgmt export,
 *    scheduling mode and an owner that was already filled in.
 */

export interface ImportedTask {
  /** Key inside the file; links refer to it (MSP UID, Excel/CSV task number). */
  key: string
  /** MSP UID: used to match the next import. */
  uid?: string
  name: string
  outlineLevel: number
  start?: string
  finish?: string
  duration?: number
  percent?: number
  milestone?: boolean
  summary?: boolean
  notes?: string
  baselineStart?: string
  baselineFinish?: string
  constraint?: { type: 'SNET' | 'MSO'; date: string }
  owner?: string
  phase?: string
  projectArea?: string
  priority?: string
  status?: string
  mgmtExport?: boolean
  links: { predKey: string; type: LinkType; lag: number }[]
}

export type ImportSource = 'msp' | 'excel' | 'csv'

export interface FieldChange {
  field: string
  old: string
  new: string
}

export interface ImportPlan {
  source: ImportSource
  fileName: string
  matchedBy: 'uid' | 'name'
  /** Final tasks in file order (matched ones keep their id and PM fields). */
  ordered: Task[]
  added: Task[]
  updated: { task: Task; before: Task; changes: FieldChange[] }[]
  unchanged: Task[]
  /** In the project (from an earlier import) but not in the file. */
  removed: Task[]
  warnings: string[]
}

export interface PlanOptions {
  /** Take the file's baseline as the primary baseline. */
  baseline: boolean
  /** New tasks are auto-scheduled instead of keeping the file's dates. */
  autoSchedule: boolean
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export function fromMsp(p: MspProject): ImportedTask[] {
  return p.tasks.map((t) => ({
    key: t.uid,
    uid: t.uid,
    name: t.name,
    outlineLevel: t.outlineLevel,
    start: t.start,
    finish: t.finish,
    duration: t.duration,
    percent: t.percent,
    milestone: t.milestone,
    summary: t.summary,
    notes: t.notes,
    baselineStart: t.baselineStart,
    baselineFinish: t.baselineFinish,
    constraint: t.constraint,
    owner: t.resources.join(', ') || undefined,
    links: t.links.map((l) => ({ predKey: l.predUid, type: l.type, lag: l.lag })),
  }))
}

function statusFor(percent: number | undefined, current: string | undefined, statuses: Project['lists']['statuses']): string | undefined {
  const done = statusOfKind('Done', statuses)
  const notStarted = statusOfKind('Not started', statuses)
  const inProgress = statusOfKind('In progress', statuses)
  if (percent === undefined) return current
  if (!current) return percent >= 1 ? done : percent > 0 ? inProgress : notStarted
  const kind = statusKind(current, statuses)
  if (percent >= 1 && kind !== 'Done' && kind !== 'Cancelled') return done
  if (percent < 1 && kind === 'Done') return inProgress
  if (percent > 0 && kind === 'Not started') return inProgress
  return current
}

const label = (v: unknown) => (v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))

export function planTaskImport(
  project: Project,
  imported: ImportedTask[],
  meta: { source: ImportSource; fileName: string; matchedBy: 'uid' | 'name'; warnings?: string[] },
  opts: PlanOptions,
): ImportPlan {
  const warnings = [...(meta.warnings ?? [])]
  const existing = project.tasks
  const statuses = project.lists.statuses

  // --- matching ---------------------------------------------------------------
  const byUid = new Map(existing.filter((t) => t.uid).map((t) => [t.uid!, t]))
  // Same-named tasks are matched in order (the n-th "Testing" in the file to the n-th in the project).
  const byName = new Map<string, Task[]>()
  for (const t of existing) byName.set(norm(t.name), [...(byName.get(norm(t.name)) ?? []), t])
  const used = new Set<string>()
  const match = new Map<string, Task>() // import key -> existing task
  for (const it of imported) {
    let hit: Task | undefined
    if (meta.matchedBy === 'uid' && it.uid) hit = byUid.get(it.uid)
    // First MSP import into a project that was typed in by hand: adopt tasks with the same name.
    if (!hit && !(meta.matchedBy === 'uid' && byUid.size > 0)) hit = byName.get(norm(it.name))?.find((t) => !used.has(t.id))
    if (hit && !used.has(hit.id)) {
      used.add(hit.id)
      match.set(it.key, hit)
    }
  }
  let nextNo = Math.max(0, ...existing.map((t) => t.no)) + 1
  const idByKey = new Map<string, string>()
  for (const it of imported) idByKey.set(it.key, match.get(it.key)?.id ?? newId('t'))

  // --- build tasks ------------------------------------------------------------
  const added: Task[] = []
  const updated: ImportPlan['updated'] = []
  const unchanged: Task[] = []
  const ordered: Task[] = []
  const now = new Date().toISOString()
  const fallbackPhase = project.lists.phases[0] ?? ''

  for (const it of imported) {
    const old = match.get(it.key)
    const id = idByKey.get(it.key)!
    const deps: Dependency[] = it.links
      .map((l) => ({ predId: idByKey.get(l.predKey) ?? '', type: l.type, lag: l.lag }))
      .filter((d) => d.predId && d.predId !== id)
    const percent = it.percent
    const fileOwned: Partial<Task> = {
      name: it.name,
      outlineLevel: it.outlineLevel,
      uid: it.uid ?? old?.uid,
      currentStart: it.start,
      currentFinish: it.finish ?? it.start,
      duration: it.milestone ? 0 : it.duration ?? old?.duration,
      percentComplete: percent ?? old?.percentComplete ?? 0,
      milestone: Boolean(it.milestone),
      dependencies: deps,
    }
    // Only MS Project carries constraints; Excel / CSV must not wipe them.
    if (meta.source === 'msp') fileOwned.constraint = it.constraint
    if (opts.baseline && (it.baselineStart || it.baselineFinish)) {
      fileOwned.baselineStart = it.baselineStart
      fileOwned.baselineFinish = it.baselineFinish
    }

    if (!old) {
      const task: Task = {
        id,
        no: nextNo++,
        outlineLevel: it.outlineLevel,
        wbs: '',
        name: it.name,
        phase: it.phase ?? fallbackPhase,
        projectArea: it.projectArea,
        status: it.status ?? statusFor(percent, undefined, statuses) ?? statusOfKind('Not started', statuses),
        owner: it.owner ?? '',
        percentComplete: percent ?? 0,
        schedulingMode: opts.autoSchedule && !it.summary ? 'auto' : 'manual',
        dependencies: deps,
        milestone: Boolean(it.milestone),
        priority: it.priority ?? project.lists.priorities[2] ?? project.lists.priorities[0] ?? 'Medium',
        mgmtExport: Boolean(it.mgmtExport),
        notes: it.notes,
        source: meta.source,
        lastImported: now,
        ...fileOwned,
      } as Task
      added.push(task)
      ordered.push(task)
      continue
    }

    const next: Task = { ...old, ...fileOwned, source: meta.source }
    // MSP resources only fill an empty owner; an Excel / CSV column is the file's own data.
    if (it.owner && (!old.owner || meta.source !== 'msp')) next.owner = it.owner
    if (it.phase) next.phase = it.phase
    if (it.projectArea) next.projectArea = it.projectArea
    if (it.priority) next.priority = it.priority
    if (it.notes && (!old.notes || meta.source !== 'msp')) next.notes = it.notes
    if (it.mgmtExport !== undefined) next.mgmtExport = it.mgmtExport
    next.status = it.status ?? statusFor(percent, old.status, statuses) ?? old.status
    // Tasks that came from MS Project keep the file's dates unless the PM switched them to auto.
    const changes: FieldChange[] = []
    for (const field of ['name', 'notes', 'outlineLevel', 'currentStart', 'currentFinish', 'duration', 'percentComplete', 'milestone', 'status', 'owner', 'phase', 'projectArea', 'priority', 'baselineStart', 'baselineFinish', 'constraint', 'dependencies'] as const) {
      const a = field === 'dependencies' ? JSON.stringify(old.dependencies) : label(old[field])
      const b = field === 'dependencies' ? JSON.stringify(next.dependencies) : label(next[field])
      if (a !== b) {
        changes.push({
          field,
          old: field === 'dependencies' ? describeDeps(old.dependencies, existing) : a,
          new: field === 'dependencies' ? describeDeps(next.dependencies, [...existing, ...added, ...ordered, next]) : b,
        })
      }
    }
    if (changes.length) {
      next.lastImported = now
      updated.push({ task: next, before: old, changes })
    } else unchanged.push(old)
    ordered.push(changes.length ? next : old)
  }

  const removed = existing.filter((t) => t.uid && meta.matchedBy === 'uid' && !used.has(t.id))
  const unknownPhases = new Set(imported.map((t) => t.phase).filter((p): p is string => Boolean(p) && !project.lists.phases.includes(p!)))
  if (unknownPhases.size) warnings.push(`Nové fáze přidané do číselníku: ${[...unknownPhases].join(', ')}.`)
  return { source: meta.source, fileName: meta.fileName, matchedBy: meta.matchedBy, ordered, added, updated, unchanged, removed, warnings }
}

function describeDeps(deps: Dependency[], tasks: Task[]): string {
  if (!deps.length) return '—'
  return deps
    .map((d) => `#${tasks.find((t) => t.id === d.predId)?.no ?? '?'}${d.type}${d.lag ? (d.lag > 0 ? '+' : '') + d.lag + 'd' : ''}`)
    .join('; ')
}

export type RemovedChoice = 'keep' | 'cancel' | 'delete'

/** Writes a reviewed plan into the project. */
export function applyImportPlan(project: Project, plan: ImportPlan, removedChoice: RemovedChoice, user: string): Project {
  const statuses = project.lists.statuses
  const cancelled = statusOfKind('Cancelled', statuses)
  const removedIds = new Set(plan.removed.map((t) => t.id))
  const inFile = new Set(plan.ordered.map((t) => t.id))
  // Tasks not in the file: created in the app (kept at the end) or removed in MS Project (by choice).
  const rest = project.tasks
    .filter((t) => !inFile.has(t.id))
    .filter((t) => !(removedIds.has(t.id) && removedChoice === 'delete'))
    .map((t) => (removedIds.has(t.id) && removedChoice === 'cancel' ? { ...t, status: cancelled } : t))
  const survivors = new Set([...plan.ordered, ...rest].map((t) => t.id))
  const clean = (t: Task): Task => ({ ...t, dependencies: t.dependencies.filter((d) => survivors.has(d.predId)) })
  const phases = [...project.lists.phases]
  const areas = [...project.lists.projectAreas]
  for (const t of plan.ordered) {
    if (t.phase && !phases.includes(t.phase)) phases.push(t.phase)
    if (t.projectArea && !areas.includes(t.projectArea)) areas.push(t.projectArea)
  }
  const record: ImportRecord = {
    id: newId('imp'),
    at: new Date().toISOString(),
    user,
    source: plan.source,
    fileName: plan.fileName,
    added: plan.added.length,
    updated: plan.updated.length,
    removed: plan.removed.length,
    unchanged: plan.unchanged.length,
  }
  return {
    ...project,
    lists: { ...project.lists, phases, projectAreas: areas },
    tasks: [...plan.ordered, ...rest].map(clean),
    importLog: [...(project.importLog ?? []), record],
  }
}

/** One summary line + one line per task for the audit trail. */
export function auditForPlan(plan: ImportPlan, removedChoice: RemovedChoice, projectId: string) {
  const entries: { entity: 'task' | 'project'; entityId: string; label: string; action: 'create' | 'update' | 'delete'; field?: string; old?: string; new?: string }[] = [
    {
      entity: 'project',
      entityId: projectId,
      label: `Import ${plan.fileName}`,
      action: 'create',
      field: 'import',
      new: `+${plan.added.length} ~${plan.updated.length} −${removedChoice === 'keep' ? 0 : plan.removed.length} =${plan.unchanged.length}`,
    },
  ]
  for (const t of plan.added.slice(0, 300)) entries.push({ entity: 'task', entityId: t.id, label: `#${t.no} ${t.name}`, action: 'create' })
  for (const u of plan.updated.slice(0, 300)) for (const c of u.changes) entries.push({ entity: 'task', entityId: u.task.id, label: `#${u.task.no} ${u.task.name}`, action: 'update', field: c.field, old: c.old, new: c.new })
  if (removedChoice !== 'keep') for (const t of plan.removed) entries.push({ entity: 'task', entityId: t.id, label: `#${t.no} ${t.name}`, action: removedChoice === 'delete' ? 'delete' : 'update', field: removedChoice === 'cancel' ? 'status' : undefined, new: removedChoice === 'cancel' ? 'Cancelled' : undefined })
  return entries
}
