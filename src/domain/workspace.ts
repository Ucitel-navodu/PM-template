import { z } from 'zod'
import type { Absence, CalendarSettings, Dependency, LinkType, Project, ProjectInfo, ProjectLists, Task, Workspace } from '../types'
import { WORKSPACE_SCHEMA_VERSION } from '../types'
import { defaultCalendar, defaultLists } from '../data/settings'
import {
  projectInfo as seedInfo,
  seedAbsences,
  seedBudget,
  seedMilestones,
  seedRisks,
  seedTasks,
} from '../data/seed'
import { applySchedule } from '../lib/schedule/cpm'

// ---------------------------------------------------------------------------
// Validation. Loose objects: unknown extra fields are kept (forward
// compatibility with newer files), missing optional ones get defaults.
// Only the shape needed to not crash the app is enforced.
// ---------------------------------------------------------------------------

const idObject = z.looseObject({ id: z.string().min(1) })
const str = z.string().catch('')
const strList = z.array(z.string())

const holidaySchema = z.object({ date: z.string(), name: z.string().catch('') })

const calendarSchema = z.object({
  holidays: z.array(holidaySchema).catch(defaultCalendar.holidays),
  workingDays: z.array(z.number().int().min(0).max(6)).catch(defaultCalendar.workingDays),
  orangeTolerance: z.number().min(0).catch(defaultCalendar.orangeTolerance),
  redTolerance: z.number().min(0).catch(defaultCalendar.redTolerance),
})

const listsSchema = z.object({
  phases: strList.catch(defaultLists.phases),
  projectAreas: strList.catch(defaultLists.projectAreas),
  budgetCategories: strList.catch(defaultLists.budgetCategories),
})

const projectInfoSchema = z.looseObject({
  projectId: str,
  projectName: z.string().catch('Projekt'),
  businessOwner: str,
  bpm: str,
  itpm: str,
  start: str,
  plannedFinish: str,
  budget: z.number().catch(0),
  currency: z.string().catch('CZK'),
})

const projectSchema = z.looseObject({
  id: z.string().min(1),
  info: projectInfoSchema,
  lists: listsSchema.catch(defaultLists),
  tasks: z.array(idObject).catch([]),
  milestones: z.array(idObject).catch([]),
  budget: z.array(idObject).catch([]),
  risks: z.array(idObject).catch([]),
  baselines: z.array(idObject).catch([]),
  views: z.array(idObject).catch([]),
  archived: z.boolean().optional(),
  createdAt: z.string().catch(() => new Date().toISOString()),
  updatedAt: z.string().catch(() => new Date().toISOString()),
})

const workspaceSchema = z.looseObject({
  fileType: z.literal('pm-web-workspace'),
  schemaVersion: z.number(),
  id: z.string().min(1),
  revision: z.number().int().min(0).catch(0),
  savedAt: z.string().optional(),
  savedBy: z.string().optional(),
  calendar: calendarSchema.catch(defaultCalendar),
  absences: z.array(idObject).catch([]),
  projects: z.array(projectSchema),
})

// Legacy single-project export (file format v1/v2 of this app).
const legacyBundleSchema = z.looseObject({
  fileType: z.literal('pm-web-project'),
  version: z.number().optional(),
  projectInfo: projectInfoSchema,
  tasks: z.array(idObject),
  milestones: z.array(idObject).catch([]),
  budget: z.array(idObject).catch([]),
  risks: z.array(idObject).catch([]),
  settings: z.looseObject({}).optional(),
  absences: z.array(idObject).catch([]),
})

export class WorkspaceFileError extends Error {}

// ---------------------------------------------------------------------------
// Task model migration (schema 3 -> 4: scheduling). Idempotent: safe to run on
// every load, also on data that is already current.
// ---------------------------------------------------------------------------

const LINK_TYPES = new Set(['FS', 'SS', 'FF', 'SF'])
const LEGACY_PRED = /^(\d+)\s*(FS|SS|FF|SF)?\s*(?:([+-])\s*(\d+)\s*\w*)?$/i

function legacyPredecessors(text: string, ids: Set<string>, idByNo: Map<number, string>): Dependency[] {
  const deps: Dependency[] = []
  for (const raw of text.split(/[;,]/)) {
    const token = raw.trim()
    if (!token) continue
    if (ids.has(token)) {
      deps.push({ predId: token, type: 'FS', lag: 0 })
      continue
    }
    const m = LEGACY_PRED.exec(token)
    const predId = m && idByNo.get(Number(m[1]))
    if (m && predId) {
      deps.push({ predId, type: (m[2]?.toUpperCase() ?? 'FS') as LinkType, lag: m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0 })
    }
  }
  return deps
}

export function migrateTasks(raw: unknown[]): Task[] {
  const items = raw.filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === 'object')
  // Stable task numbers: keep valid unique ones, number the rest after them.
  const used = new Set<number>()
  for (const t of items) {
    const no = t.no
    if (typeof no === 'number' && Number.isInteger(no) && no > 0 && !used.has(no)) used.add(no)
    else t.no = undefined
  }
  let next = Math.max(0, ...used) + 1
  const numbered: Record<string, unknown>[] & { no: number }[] = items.map((t) => ({ ...t, no: (t.no as number | undefined) ?? next++ }))
  const ids = new Set(numbered.map((t) => String(t.id)))
  const idByNo = new Map(numbered.map((t) => [t.no as number, String(t.id)]))

  return numbered.map((t) => {
    const { predecessors, ...rest } = t as Record<string, unknown> & { predecessors?: unknown }
    const deps = Array.isArray(t.dependencies)
      ? (t.dependencies as Dependency[]).filter(
          (d) => d && ids.has(d.predId) && d.predId !== t.id && LINK_TYPES.has(d.type) && Number.isFinite(d.lag),
        )
      : typeof predecessors === 'string'
        ? legacyPredecessors(predecessors, ids, idByNo).filter((d) => d.predId !== t.id)
        : []
    const level = Number(t.outlineLevel)
    return {
      ...rest,
      outlineLevel: Number.isInteger(level) && level >= 1 ? level : 1,
      // Existing tasks keep their dates exactly: they become manually scheduled.
      schedulingMode: t.schedulingMode === 'auto' ? 'auto' : 'manual',
      dependencies: deps,
      milestone: Boolean(t.milestone),
    } as unknown as Task
  })
}

export function migrateProject(p: Project, calendar: CalendarSettings): Project {
  const migrated: Project = {
    ...p,
    tasks: migrateTasks(p.tasks as unknown[]),
    baselines: Array.isArray(p.baselines) ? p.baselines : [],
    views: Array.isArray(p.views) ? p.views : [],
  }
  return applySchedule(migrated, calendar)
}

export function migrateWorkspace(ws: Workspace): Workspace {
  return { ...ws, schemaVersion: WORKSPACE_SCHEMA_VERSION, projects: ws.projects.map((p) => migrateProject(p, ws.calendar)) }
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function newId(prefix: string): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}${Date.now().toString(36)}${rnd}`
}

export function createBlankProject(name: string, lists: ProjectLists = defaultLists): Project {
  const now = new Date().toISOString()
  const info: ProjectInfo = {
    projectId: '',
    projectName: name,
    businessOwner: '',
    bpm: '',
    itpm: '',
    start: now.slice(0, 10),
    plannedFinish: '',
    budget: 0,
    currency: 'CZK',
  }
  return {
    id: newId('p'),
    info,
    lists: structuredClone(lists),
    tasks: [],
    milestones: [],
    budget: [],
    risks: [],
    baselines: [],
    views: [],
    createdAt: now,
    updatedAt: now,
  }
}

/** Sample tasks grouped under one summary task per project area, to show the outline. */
function sampleTasks(): Task[] {
  const tasks = migrateTasks(structuredClone(seedTasks))
  const out: Task[] = []
  let area: string | undefined
  let no = Math.max(...tasks.map((t) => t.no)) + 1
  for (const t of tasks) {
    if (t.projectArea && t.projectArea !== area) {
      area = t.projectArea
      out.push({
        id: `s-${area}`,
        no: no++,
        outlineLevel: 1,
        wbs: '',
        name: area,
        phase: t.phase,
        projectArea: area,
        status: 'In progress',
        owner: '',
        percentComplete: null,
        schedulingMode: 'auto',
        dependencies: [],
        milestone: false,
        priority: 'Medium',
        mgmtExport: false,
      })
    }
    out.push({ ...t, outlineLevel: 2 })
  }
  return out
}

export function createSampleProject(calendar: CalendarSettings = defaultCalendar): Project {
  const now = new Date().toISOString()
  return applySchedule(
    {
      id: newId('p'),
      info: structuredClone(seedInfo),
      lists: structuredClone(defaultLists),
      tasks: sampleTasks(),
      milestones: structuredClone(seedMilestones),
      budget: structuredClone(seedBudget),
      risks: structuredClone(seedRisks),
      baselines: [],
      views: [],
      createdAt: now,
      updatedAt: now,
    },
    calendar,
  )
}

export function createWorkspace(projects: Project[], calendar: CalendarSettings = defaultCalendar, absences: Absence[] = []): Workspace {
  return {
    fileType: 'pm-web-workspace',
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    id: newId('w'),
    revision: 0,
    calendar: structuredClone(calendar),
    absences: structuredClone(absences),
    projects,
  }
}

export function createSampleWorkspace(): Workspace {
  return createWorkspace([createSampleProject()], defaultCalendar, structuredClone(seedAbsences))
}

// ---------------------------------------------------------------------------
// Migration / parsing
// ---------------------------------------------------------------------------

type LegacySnapshot = {
  projectInfo?: unknown
  tasks?: unknown
  milestones?: unknown
  budget?: unknown
  risks?: unknown
  settings?: unknown
  absences?: unknown
}

function splitLegacySettings(settings: unknown): { lists: ProjectLists; calendar: CalendarSettings } {
  const s = (settings ?? {}) as Record<string, unknown>
  return {
    lists: listsSchema.parse({ ...defaultLists, ...s }),
    calendar: calendarSchema.parse({ ...defaultCalendar, ...s }),
  }
}

// Old milestone records stored a typed amount; it is now derived from the
// budget x %, so the stale field is dropped.
function stripLegacyMilestoneFields(milestones: unknown[]): unknown[] {
  return milestones.map((m) => {
    if (m && typeof m === 'object' && 'paymentAmount' in m) {
      const { paymentAmount: _drop, ...rest } = m as Record<string, unknown>
      return rest
    }
    return m
  })
}

function projectFromLegacy(data: LegacySnapshot, lists: ProjectLists, calendar: CalendarSettings): Project {
  const now = new Date().toISOString()
  const project = projectSchema.parse({
    id: newId('p'),
    info: data.projectInfo,
    lists,
    tasks: data.tasks ?? [],
    milestones: stripLegacyMilestoneFields((data.milestones as unknown[]) ?? []),
    budget: data.budget ?? [],
    risks: data.risks ?? [],
    createdAt: now,
    updatedAt: now,
  }) as unknown as Project
  return migrateProject(project, calendar)
}

/** A legacy single-project export (v1/v2) turned into a project + its calendar/absences. */
export function projectFromLegacyBundle(raw: unknown): { project: Project; calendar: CalendarSettings; absences: Absence[] } {
  const bundle = legacyBundleSchema.parse(raw)
  const { lists, calendar } = splitLegacySettings(bundle.settings)
  return {
    project: projectFromLegacy(bundle as LegacySnapshot, lists, calendar),
    calendar,
    absences: bundle.absences as unknown as Absence[],
  }
}

/** The pre-workspace app kept one project in separate localStorage keys. */
export function workspaceFromLegacySnapshot(snap: LegacySnapshot): Workspace {
  const { lists, calendar } = splitLegacySettings(snap.settings)
  const project = projectFromLegacy(
    {
      ...snap,
      projectInfo: snap.projectInfo ?? seedInfo,
    },
    lists,
    calendar,
  )
  return createWorkspace([project], calendar, (snap.absences as Absence[]) ?? [])
}

export type ParsedFile =
  | { kind: 'workspace'; workspace: Workspace }
  | { kind: 'legacy-project'; project: Project; calendar: CalendarSettings; absences: Absence[] }

/** Parse any file this app has ever written. Throws WorkspaceFileError with a user-facing message. */
export function parseAnyFile(text: string): ParsedFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new WorkspaceFileError('Soubor není platný JSON.')
  }
  const type = (raw as { fileType?: unknown })?.fileType
  try {
    if (type === 'pm-web-workspace') {
      const ws = workspaceSchema.parse(raw) as unknown as Workspace
      if (ws.schemaVersion > WORKSPACE_SCHEMA_VERSION) {
        throw new WorkspaceFileError(
          'Soubor byl uložen novější verzí aplikace. Otevři ho v aktuální verzi, aby se nepřepsala data, kterým tato verze nerozumí.',
        )
      }
      return { kind: 'workspace', workspace: migrateWorkspace(ws) }
    }
    if (type === 'pm-web-project') {
      return { kind: 'legacy-project', ...projectFromLegacyBundle(raw) }
    }
  } catch (e) {
    if (e instanceof WorkspaceFileError) throw e
    throw new WorkspaceFileError('Soubor má neplatnou strukturu – chybí nebo jsou poškozená povinná data.')
  }
  throw new WorkspaceFileError('Tento soubor nevypadá jako soubor této aplikace.')
}

export function serializeWorkspace(ws: Workspace): string {
  return JSON.stringify(ws, null, 2)
}
