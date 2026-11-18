import type { BudgetItem, Milestone, Project, ProjectInfo, Risk, Task } from '../../types'
import { csvToTable, type Table } from './csv'
import { readXlsx, sheetToTable, writeXlsx, type OutSheet, type Sheet } from './xlsx'
import { guessKind, headerScore, kindOfSheet, kindOfSheetLoose, readConfigLists, readProjectInfo, norm, type ImportedLists, mapHeaders, parseDate, readBudget, readMilestones, readRisks, readTasks, type Kind, type Mapping } from './tables'
import { applyImportPlan, auditForPlan, planTaskImport, type ImportPlan, type ImportSource, type PlanOptions, type RemovedChoice } from './plan'
import { formatDependencies } from '../schedule/predecessors'
import { schedule } from '../schedule/cpm'
import { outline } from '../schedule/tree'
import { riskScore } from '../raid'
import type { CalendarSettings } from '../../types'

/** What an uploaded .xlsx / .csv contains, and what importing it would change. */
export interface TableImport<T extends { id: string }> {
  added: T[]
  updated: { item: T; before: T }[]
  unchanged: number
  warnings: string[]
  unmapped: string[]
}

export interface FilePlan {
  source: ImportSource
  fileName: string
  tasks?: ImportPlan
  milestones?: TableImport<Milestone>
  budget?: TableImport<BudgetItem>
  risks?: TableImport<Risk>
  /** Project card fields that differ from the target project (original workbook: DASHBOARD). */
  info?: Partial<ProjectInfo>
  /** New values for the project's lists (original workbook: CONFIG). */
  lists?: ImportedLists
  warnings: string[]
  unmapped: { sheet: string; columns: string[] }[]
}

function upsert<T extends { id: string }>(existing: T[], records: T[], warnings: string[], unmapped: string[]): TableImport<T> {
  const byId = new Map(existing.map((x) => [x.id, x]))
  const out: TableImport<T> = { added: [], updated: [], unchanged: 0, warnings, unmapped }
  for (const r of records) {
    const old = byId.get(r.id)
    if (!old) out.added.push(r)
    else {
      const merged = { ...old, ...Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) } as T
      if (JSON.stringify(merged) === JSON.stringify(old)) out.unchanged++
      else out.updated.push({ item: merged, before: old })
    }
  }
  return out
}

export type TableInput = { table: Table; kind: Kind; mapping?: Mapping }
export interface WorkbookExtras {
  info?: Partial<ProjectInfo>
  lists?: ImportedLists
}

/**
 * Table of a sheet whose header row may sit under title rows (the original
 * Excel template): the row among the first 25 that names the most known
 * columns wins; ties keep the first one.
 */
export function tableOfSheet(sheet: Sheet, kind: Kind): Table {
  let best = -1
  let bestScore = 1
  sheet.rows.slice(0, 25).forEach((row, i) => {
    const score = headerScore(kind, row)
    if (score > bestScore) {
      best = i
      bestScore = score
    }
  })
  if (best < 0) return sheetToTable(sheet)
  const headers = sheet.rows[best].map((h) => String(h ?? '').trim())
  const rows = sheet.rows.slice(best + 1).filter((r) => r.some((c) => c !== null && String(c).trim() !== ''))
  return { name: sheet.name, headers, rows }
}

/** Plan an import of already-read tables (one per sheet / one CSV). */
export function planTables(project: Project, inputs: TableInput[], source: ImportSource, fileName: string, opts: PlanOptions, extras: WorkbookExtras = {}): FilePlan {
  const plan: FilePlan = { source, fileName, warnings: [], unmapped: [] }
  const info = Object.fromEntries(Object.entries(extras.info ?? {}).filter(([k, v]) => v !== project.info[k as keyof ProjectInfo]))
  if (Object.keys(info).length) plan.info = info
  const lists = Object.fromEntries(
    Object.entries(extras.lists ?? {})
      .map(([k, values]) => [k, values.filter((v) => !project.lists[k as keyof ImportedLists].includes(v))])
      .filter(([, values]) => values.length),
  ) as ImportedLists
  if (Object.keys(lists).length) plan.lists = lists
  for (const { table, kind, mapping } of inputs) {
    if (kind === 'tasks') {
      const r = readTasks(table, project, mapping)
      plan.tasks = planTaskImport(project, r.records, { source, fileName, matchedBy: 'name', warnings: r.warnings }, opts)
      if (r.unmapped.length) plan.unmapped.push({ sheet: table.name, columns: r.unmapped })
    } else {
      const r = kind === 'milestones' ? readMilestones(table, project) : kind === 'budget' ? readBudget(table, project) : readRisks(table, project)
      if (r.unmapped.length) plan.unmapped.push({ sheet: table.name, columns: r.unmapped })
      if (kind === 'milestones') plan.milestones = upsert(project.milestones, r.records as Milestone[], r.warnings, r.unmapped)
      if (kind === 'budget') plan.budget = upsert(project.budget, r.records as BudgetItem[], r.warnings, r.unmapped)
      if (kind === 'risks') plan.risks = upsert(project.risks, r.records as Risk[], r.warnings, r.unmapped)
    }
  }
  if (!plan.tasks && !plan.milestones && !plan.budget && !plan.risks && !plan.info && !plan.lists) plan.warnings.push('V souboru jsem nenašel žádná data, kterým rozumím (úkoly, milníky, rozpočet, rizika).')
  return plan
}

/** Read a file the user picked: `.xlsx` (every recognised sheet) or `.csv` (one table, kind guessed from the headers). */
export async function readTableFile(name: string, data: ArrayBuffer, decode: (b: ArrayBuffer) => string): Promise<{ source: ImportSource; inputs: TableInput[]; extras?: WorkbookExtras }> {
  if (/\.csv$|\.txt$/i.test(name)) {
    const table = csvToTable(decode(data), name)
    return { source: 'csv', inputs: [{ table, kind: guessKind(table.headers) }] }
  }
  const sheets = await readXlsx(data)
  const inputs: TableInput[] = []
  // Exact sheet names first (TASKS, Úkoly, ...); a looser match (e.g. "Risk register") only for kinds still missing.
  for (const match of [kindOfSheet, kindOfSheetLoose]) {
    for (const s of sheets) {
      const kind = match(s.name)
      if (kind && !inputs.some((i) => i.kind === kind)) inputs.push({ table: tableOfSheet(s, kind), kind })
    }
  }
  const extras: WorkbookExtras = {}
  const card = sheets.find((s) => /^(dashboard|project|projectinfo|info|projekt|prehled)$/.test(norm(s.name)))
  if (card) extras.info = readProjectInfo(card.rows)
  const config = sheets.find((s) => /^(config|settings|lists|nastaveni|ciselniky)$/.test(norm(s.name)))
  if (config) extras.lists = readConfigLists(config.rows)
  // A single unnamed sheet (e.g. "List1") is treated like a CSV.
  if (inputs.length === 0 && sheets.length === 1) {
    const table = sheetToTable(sheets[0])
    inputs.push({ table, kind: guessKind(table.headers) })
  }
  return { source: 'excel', inputs, extras }
}

export function applyFilePlan(project: Project, plan: FilePlan, removed: RemovedChoice, user: string): Project {
  let p = project
  if (plan.tasks) p = applyImportPlan(p, plan.tasks, removed, user)
  const merge = <T extends { id: string }>(list: T[], t?: TableImport<T>) =>
    t ? [...list.map((x) => t.updated.find((u) => u.item.id === x.id)?.item ?? x), ...t.added] : list
  const lists = plan.lists
    ? { ...p.lists, ...Object.fromEntries(Object.entries(plan.lists).map(([k, add]) => [k, [...p.lists[k as keyof ImportedLists], ...add]])) }
    : p.lists
  return { ...p, info: plan.info ? { ...p.info, ...plan.info } : p.info, lists, milestones: merge(p.milestones, plan.milestones), budget: merge(p.budget, plan.budget), risks: merge(p.risks, plan.risks) }
}

export function auditForFilePlan(plan: FilePlan, removed: RemovedChoice, projectId: string) {
  const out = plan.tasks ? auditForPlan(plan.tasks, removed, projectId) : []
  const count = (label: string, t?: TableImport<{ id: string }>) =>
    t ? [{ entity: 'project' as const, entityId: projectId, label: `Import ${plan.fileName}: ${label}`, action: 'create' as const, field: 'import', new: `+${t.added.length} ~${t.updated.length}` }] : []
  const extra = [
    ...(plan.info ? [{ entity: 'project' as const, entityId: projectId, label: `Import ${plan.fileName}: project card`, action: 'update' as const, field: 'info', new: Object.keys(plan.info).join(', ') }] : []),
    ...(plan.lists ? [{ entity: 'project' as const, entityId: projectId, label: `Import ${plan.fileName}: lists`, action: 'update' as const, field: 'lists', new: Object.values(plan.lists).flat().join(', ') }] : []),
  ]
  return [...out, ...count('milestones', plan.milestones), ...count('budget', plan.budget), ...count('risks', plan.risks), ...extra]
}

// --- export ------------------------------------------------------------------------------

const toDate = (key?: string) => (key ? new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) : undefined)

/** Whole project as a workbook: TASKS, MILESTONES, BUDGET, RAID, CHANGES, CONFIG. Column names match what the import reads. */
export async function exportWorkbook(project: Project, calendar: Pick<CalendarSettings, 'workingDays' | 'holidays'>): Promise<Uint8Array> {
  return writeXlsx(projectSheets(project, calendar))
}

export function projectSheets(project: Project, calendar: Pick<CalendarSettings, 'workingDays' | 'holidays'>): OutSheet[] {
  const res = schedule(project.tasks, calendar, project.info.start || undefined, project.lists.statuses)
  const tree = outline(project.tasks)
  const tasks: OutSheet = {
    name: 'TASKS',
    headers: ['No', 'WBS', 'Outline Level', 'Task Name', 'Mode', 'Duration (workdays)', 'Current Start', 'Current Finish', 'Predecessors', 'Percent Complete', 'Status', 'Owner', 'Phase', 'Project Area', 'Priority', 'Milestone', 'Summary', 'Total Slack (workdays)', 'Critical', 'Baseline Start', 'Baseline Finish', 'Mgmt Export', 'Notes'],
    widths: [6, 8, 8, 40, 9, 10, 13, 13, 16, 10, 14, 18, 16, 16, 12, 9, 9, 10, 9, 13, 13, 10, 40],
    rows: project.tasks.map((t: Task) => [
      t.no,
      tree.get(t.id)?.wbs ?? t.wbs,
      t.outlineLevel,
      t.name,
      t.schedulingMode,
      t.duration,
      toDate(t.currentStart),
      toDate(t.currentFinish),
      formatDependencies(t.dependencies, project.tasks),
      t.percentComplete ?? undefined,
      t.status,
      t.owner,
      t.phase,
      t.projectArea,
      t.priority,
      t.milestone ? 'YES' : 'NO',
      tree.get(t.id)?.isSummary ? 'YES' : 'NO',
      res.tasks.get(t.id)?.totalFloat,
      res.tasks.get(t.id)?.critical ? 'YES' : 'NO',
      toDate(t.baselineStart),
      toDate(t.baselineFinish),
      t.mgmtExport ? 'YES' : 'NO',
      t.notes,
    ]),
  }
  const milestones: OutSheet = {
    name: 'MILESTONES',
    headers: ['ID', 'Name', 'Planned Date', 'Baseline Date', 'Actual Date', 'Payment Trigger %', 'Amount', 'Invoice No', 'Payment Status', 'Notes'],
    widths: [8, 36, 13, 13, 13, 12, 14, 12, 14, 36],
    rows: project.milestones.map((m) => [m.id, m.name, toDate(m.plannedDate), toDate(m.baselineDate), toDate(m.actualDate), m.paymentTriggerPct, Math.round(m.paymentTriggerPct * project.info.budget), m.invoiceNo, m.paymentStatus, m.notes]),
  }
  const budget: OutSheet = {
    name: 'BUDGET',
    headers: ['ID', 'Category', 'Cost Type', 'Supplier', 'Description', 'Planned', 'Committed', 'Actual', 'Forecast', 'Due Date', 'Payment Status', 'Invoice No', 'Notes'],
    widths: [8, 16, 10, 20, 36, 14, 14, 14, 14, 13, 14, 12, 30],
    rows: project.budget.map((b) => [b.id, b.category, b.costType, b.supplier, b.description, b.planned, b.committed, b.actual, Math.max(b.planned, b.committed, b.actual), toDate(b.dueDate), b.paymentStatus, b.invoiceNo, b.notes]),
  }
  const raid: OutSheet = {
    name: 'RISKS',
    headers: ['ID', 'Type', 'Title', 'Description', 'Project Area', 'Probability', 'Impact', 'P×I', 'Owner', 'Mitigation', 'Due Date', 'Status', 'Comment'],
    widths: [8, 12, 30, 40, 16, 12, 10, 6, 18, 36, 13, 12, 30],
    rows: project.risks.map((r) => [r.id, r.type, r.title, r.description, r.area, r.probability, r.impact, ['Risk', 'Issue'].includes(r.type) ? riskScore(r) : undefined, r.owner, r.mitigation, toDate(r.dueDate), r.status, r.comment]),
  }
  const changes: OutSheet = {
    name: 'CHANGES',
    headers: ['ID', 'Title', 'Description', 'Type', 'Status', 'Requested By', 'Raised', 'Impact (workdays)', 'Impact (cost)', 'Decided By', 'Decision Date'],
    widths: [8, 30, 40, 10, 12, 18, 13, 10, 14, 18, 13],
    rows: project.changes.map((c) => [c.id, c.title, c.description, c.type, c.status, c.requestedBy, toDate(c.raised), c.impactDays, c.impactCost, c.decidedBy, toDate(c.decisionDate)]),
  }
  const n = Math.max(project.lists.phases.length, project.lists.projectAreas.length, project.lists.budgetCategories.length, project.lists.statuses.length, project.lists.priorities.length)
  const config: OutSheet = {
    name: 'CONFIG',
    headers: ['Phases', 'Project Areas', 'Budget Categories', 'Statuses', 'Status Meaning', 'Priorities'],
    rows: Array.from({ length: n }, (_, i) => [project.lists.phases[i], project.lists.projectAreas[i], project.lists.budgetCategories[i], project.lists.statuses[i]?.name, project.lists.statuses[i]?.kind, project.lists.priorities[i]]),
  }
  return [tasks, milestones, budget, raid, changes, config]
}

export { mapHeaders, parseDate }
