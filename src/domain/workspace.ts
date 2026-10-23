import { z } from 'zod'
import type { Absence, CalendarSettings, Project, ProjectInfo, ProjectLists, Workspace } from '../types'
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
    createdAt: now,
    updatedAt: now,
  }
}

export function createSampleProject(): Project {
  const now = new Date().toISOString()
  return {
    id: newId('p'),
    info: structuredClone(seedInfo),
    lists: structuredClone(defaultLists),
    tasks: structuredClone(seedTasks),
    milestones: structuredClone(seedMilestones),
    budget: structuredClone(seedBudget),
    risks: structuredClone(seedRisks),
    createdAt: now,
    updatedAt: now,
  }
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

function projectFromLegacy(data: LegacySnapshot, lists: ProjectLists): Project {
  const now = new Date().toISOString()
  return projectSchema.parse({
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
}

/** A legacy single-project export (v1/v2) turned into a project + its calendar/absences. */
export function projectFromLegacyBundle(raw: unknown): { project: Project; calendar: CalendarSettings; absences: Absence[] } {
  const bundle = legacyBundleSchema.parse(raw)
  const { lists, calendar } = splitLegacySettings(bundle.settings)
  return {
    project: projectFromLegacy(bundle as LegacySnapshot, lists),
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
      return { kind: 'workspace', workspace: { ...ws, schemaVersion: WORKSPACE_SCHEMA_VERSION } }
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
