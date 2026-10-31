import type { BudgetItem, ImpactLevel, Milestone, PaymentStatus, Project, Risk, RiskStatus, RiskType } from '../../types'
import type { Cell, Table } from './csv'
import { fromExcelSerial } from './xlsx'
import { toDateKey } from '../dates'
import type { ImportedTask } from './plan'
import { parseDependencies } from '../schedule/predecessors'

/*
 * Maps a table (CSV or an Excel sheet) onto the app's records. Headers are
 * matched after removing diacritics / case / punctuation, in Czech and
 * English, so both the original workbook's and this app's own export are read.
 */

export type Kind = 'tasks' | 'milestones' | 'budget' | 'risks'

const SYNONYMS: Record<Kind, Record<string, string[]>> = {
  tasks: {
    no: ['no', 'id', 'cislo', 'taskno', 'taskid', 'ukolcislo'],
    wbs: ['wbs'],
    name: ['name', 'taskname', 'task', 'nazev', 'nazevukolu', 'ukol', 'nazevulohy'],
    phase: ['phase', 'faze'],
    projectArea: ['projectarea', 'area', 'oblast', 'oblastprojektu'],
    status: ['status', 'stav'],
    owner: ['owner', 'vlastnik', 'zodpovedny', 'resource', 'resources', 'zdroje'],
    start: ['start', 'currentstart', 'aktualnistart', 'zacatek', 'datumzahajeni'],
    finish: ['finish', 'currentfinish', 'aktualnikonec', 'konec', 'datumukonceni', 'end'],
    baselineStart: ['baselinestart'],
    baselineFinish: ['baselinefinish', 'baselinetermin'],
    duration: ['duration', 'durationworkdays', 'doba', 'trvani', 'dobapd'],
    percent: ['percentcomplete', 'complete', 'dokonceni', 'percent', 'procentodokonceni', 'procentadokonceni'],
    predecessors: ['predecessors', 'predchudci', 'predecessor', 'predchudce'],
    priority: ['priority', 'priorita'],
    milestone: ['milestone', 'milnik'],
    mgmtExport: ['mgmtexport', 'exportprovedeni', 'exportprovedeni'],
    notes: ['notes', 'poznamky', 'poznamka', 'komentar'],
    level: ['outlinelevel', 'level', 'uroven'],
  },
  milestones: {
    id: ['id', 'cislo'],
    name: ['name', 'nazev', 'milestone', 'milnik'],
    plannedDate: ['planneddate', 'plan', 'planovanydatum', 'termin', 'plannedfinish', 'date', 'datum'],
    baselineDate: ['baselinedate', 'baseline'],
    actualDate: ['actualdate', 'skutecnost', 'skutecnedatum'],
    paymentTriggerPct: ['paymenttriggerpct', 'paymenttrigger', 'platebnispoustec', 'platba', 'trigger'],
    invoiceNo: ['invoiceno', 'cislofaktury'],
    paymentStatus: ['paymentstatus', 'stavplatby'],
    notes: ['notes', 'poznamky'],
  },
  budget: {
    id: ['id', 'cislo'],
    category: ['category', 'kategorie'],
    supplier: ['supplier', 'dodavatel'],
    description: ['description', 'popis'],
    planned: ['planned', 'plan', 'planovano'],
    committed: ['committed', 'zavazky', 'zavazano', 'po'],
    actual: ['actual', 'skutecnost', 'skutecne', 'invoiced'],
    dueDate: ['duedate', 'splatnost', 'termin'],
    paymentStatus: ['paymentstatus', 'stavplatby'],
    invoiceNo: ['invoiceno', 'cislofaktury'],
    notes: ['notes', 'poznamky'],
  },
  risks: {
    id: ['id', 'cislo'],
    type: ['type', 'typ'],
    title: ['title', 'nazev'],
    description: ['description', 'popis'],
    area: ['area', 'projectarea', 'oblast', 'oblastprojektu'],
    probability: ['probability', 'pravdepodobnost'],
    impact: ['impact', 'dopad'],
    owner: ['owner', 'vlastnik'],
    mitigation: ['mitigation', 'opatreni'],
    dueDate: ['duedate', 'termin'],
    status: ['status', 'stav'],
    comment: ['comment', 'komentar', 'notes', 'poznamky'],
  },
}

export const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/** Which sheet is which: by name (TASKS, Úkoly, MILESTONES, ...). */
export function kindOfSheet(name: string): Kind | undefined {
  const n = norm(name)
  if (/^(tasks?|ukoly|ukol)$/.test(n)) return 'tasks'
  if (/^(milestones?|milniky)$/.test(n)) return 'milestones'
  if (/^(budget|rozpocet)$/.test(n)) return 'budget'
  if (/^(risks?|raid|rizika)$/.test(n)) return 'risks'
  return undefined
}

/** Guess the kind from the headers (CSV has no sheet name). */
export function guessKind(headers: string[]): Kind {
  const hs = new Set(headers.map(norm))
  const score = (k: Kind) => Object.values(SYNONYMS[k]).filter((syn) => syn.some((s) => hs.has(s))).length
  return (['tasks', 'milestones', 'budget', 'risks'] as Kind[]).sort((a, b) => score(b) - score(a))[0]
}

export interface Mapping {
  /** field -> column index */
  columns: Record<string, number>
  unmapped: string[]
}

export function mapHeaders(kind: Kind, headers: string[]): Mapping {
  const columns: Record<string, number> = {}
  const taken = new Set<number>()
  for (const [field, syns] of Object.entries(SYNONYMS[kind])) {
    // exact synonym order = priority (e.g. "currentstart" before the generic "start")
    for (const s of syns) {
      const i = headers.findIndex((h, idx) => !taken.has(idx) && norm(h) === s)
      if (i >= 0) {
        columns[field] = i
        taken.add(i)
        break
      }
    }
  }
  return { columns, unmapped: headers.filter((h, i) => h.trim() && !taken.has(i)) }
}

// --- value parsing -----------------------------------------------------------------------

/** `2026-11-09`, `9.11.2026`, `9. 11. 2026`, `11/9/2026` (US), Excel serial -> `YYYY-MM-DD`. */
export function parseDate(v: Cell | undefined): string | undefined {
  if (v === null || v === undefined || v === '') return undefined
  if (typeof v === 'number') return v > 20000 && v < 80000 ? toDateKey(fromExcelSerial(v)) : undefined
  const s = v.trim()
  // A real calendar date only: 31.31.2026 or 30.2.2026 are rejected instead of rolling over.
  const make = (y: number, mo: number, d: number) => {
    const t = new Date(y, mo - 1, d)
    return y >= 1900 && y <= 2200 && t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d ? toDateKey(t) : undefined
  }
  let m = /^(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(s)
  if (m) return make(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})(?!\d)/.exec(s)
  if (m) return make(Number(m[3]), Number(m[2]), Number(m[1]))
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/.exec(s)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    return a > 12 ? make(Number(m[3]), b, a) : make(Number(m[3]), a, b)
  }
  if (/^\d{5}$/.test(s)) return parseDate(Number(s))
  return undefined
}

const toNumber = (v: Cell | undefined): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined
  if (typeof v === 'number') return v
  const n = Number(v.replace(/\s| /g, '').replace(/[^\d,.\-]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}
/** `50`, `50 %`, `0.5` (Excel percent format) -> 0..1 */
const toPercent = (v: Cell | undefined): number | undefined => {
  const n = toNumber(v)
  if (n === undefined) return undefined
  return Math.min(1, Math.max(0, n > 1 ? n / 100 : n))
}
const toBool = (v: Cell | undefined): boolean | undefined => {
  if (v === null || v === undefined || v === '') return undefined
  return ['1', 'true', 'yes', 'ano', 'y', 'x', 'pravda'].includes(String(v).trim().toLowerCase())
}
const text = (v: Cell | undefined): string | undefined => {
  if (v === null || v === undefined) return undefined
  const s = String(v).trim()
  return s === '' ? undefined : s
}
const pick = <T extends string>(v: Cell | undefined, allowed: readonly T[]): T | undefined => {
  const s = norm(v)
  return allowed.find((a) => norm(a) === s)
}

export interface ReadResult<T> {
  records: T[]
  warnings: string[]
  unmapped: string[]
}

const cellAt = (row: Cell[], m: Mapping, field: string) => (m.columns[field] === undefined ? undefined : row[m.columns[field]])

// --- tasks ---------------------------------------------------------------------------------

/**
 * Rows -> imported tasks. Task numbers in the file ("No"/"ID" column, otherwise the
 * row order) are the keys the predecessor column refers to.
 */
export function readTasks(table: Table, project: Project, override?: Mapping): ReadResult<ImportedTask> {
  const m = override ?? mapHeaders('tasks', table.headers)
  const warnings: string[] = []
  if (m.columns.name === undefined) return { records: [], unmapped: m.unmapped, warnings: ['Chybí sloupec s názvem úkolu (Task Name / Název úkolu).'] }
  const statuses = project.lists.statuses.map((s) => s.name)
  const priorities = project.lists.priorities
  const keyed = table.rows.map((row, i) => ({ row, key: String(toNumber(cellAt(row, m, 'no')) ?? i + 1) }))
  // predecessors are written with task numbers of the file: resolve them through a throw-away task list
  const fake = keyed.map(({ key }, i) => ({ id: `k${key}`, no: Number(key) || i + 1 }) as never)
  const records: ImportedTask[] = []
  for (const { row, key } of keyed) {
    const name = text(cellAt(row, m, 'name'))
    if (!name) continue
    const wbs = text(cellAt(row, m, 'wbs'))
    const level = toNumber(cellAt(row, m, 'level')) ?? (wbs ? wbs.split('.').length : 1)
    const start = parseDate(cellAt(row, m, 'start'))
    const finish = parseDate(cellAt(row, m, 'finish'))
    const milestone = toBool(cellAt(row, m, 'milestone')) ?? false
    const preds = text(cellAt(row, m, 'predecessors'))
    let links: ImportedTask['links'] = []
    if (preds) {
      const parsed = parseDependencies(preds, fake, `k${key}`)
      links = parsed.deps.map((d) => ({ predKey: d.predId.slice(1), type: d.type, lag: d.lag }))
      if (parsed.errors.length) warnings.push(`Úkol „${name}“: předchůdce nelze přečíst (${parsed.errors.join(', ')}).`)
    }
    for (const [field, v] of [['Start', cellAt(row, m, 'start')], ['Finish', cellAt(row, m, 'finish')]] as const) {
      if (v !== undefined && v !== null && v !== '' && !parseDate(v)) warnings.push(`Úkol „${name}“: ${field} „${v}“ není platné datum.`)
    }
    records.push({
      key,
      name,
      outlineLevel: Math.max(1, Math.round(level)),
      start,
      finish: milestone ? start : finish,
      duration: toNumber(cellAt(row, m, 'duration')),
      percent: toPercent(cellAt(row, m, 'percent')),
      milestone,
      notes: text(cellAt(row, m, 'notes')),
      baselineStart: parseDate(cellAt(row, m, 'baselineStart')),
      baselineFinish: parseDate(cellAt(row, m, 'baselineFinish')),
      owner: text(cellAt(row, m, 'owner')),
      phase: text(cellAt(row, m, 'phase')),
      projectArea: text(cellAt(row, m, 'projectArea')),
      priority: pick(cellAt(row, m, 'priority'), priorities),
      status: pick(cellAt(row, m, 'status'), statuses),
      mgmtExport: toBool(cellAt(row, m, 'mgmtExport')),
      links,
    })
  }
  return { records, warnings, unmapped: m.unmapped }
}

// --- milestones, budget, risks -----------------------------------------------------------

const PAYMENT: readonly PaymentStatus[] = ['Not due', 'Invoiced', 'Paid', 'Overdue', 'Cancelled']
const LEVELS: readonly ImpactLevel[] = ['Low', 'Medium', 'High', 'Critical']
const RISK_STATUS: readonly RiskStatus[] = ['Open', 'Mitigated', 'Closed', 'Accepted', 'Cancelled']
const RISK_TYPE: readonly RiskType[] = ['Risk', 'Issue', 'Assumption', 'Dependency', 'Decision']

export function readMilestones(table: Table, project: Project): ReadResult<Milestone> {
  const m = mapHeaders('milestones', table.headers)
  const warnings: string[] = []
  const records: Milestone[] = []
  let n = project.milestones.length
  for (const row of table.rows) {
    const name = text(cellAt(row, m, 'name'))
    if (!name) continue
    const pct = toPercent(cellAt(row, m, 'paymentTriggerPct')) ?? 0
    records.push({
      id: text(cellAt(row, m, 'id')) ?? `M${String(++n).padStart(2, '0')}`,
      name,
      plannedDate: parseDate(cellAt(row, m, 'plannedDate')),
      baselineDate: parseDate(cellAt(row, m, 'baselineDate')),
      actualDate: parseDate(cellAt(row, m, 'actualDate')),
      paymentTriggerPct: pct,
      invoiceNo: text(cellAt(row, m, 'invoiceNo')),
      paymentStatus: pick(cellAt(row, m, 'paymentStatus'), PAYMENT) ?? 'Not due',
      notes: text(cellAt(row, m, 'notes')),
    })
  }
  return { records, warnings, unmapped: m.unmapped }
}

export function readBudget(table: Table, project: Project): ReadResult<BudgetItem> {
  const m = mapHeaders('budget', table.headers)
  const records: BudgetItem[] = []
  let n = project.budget.length
  for (const row of table.rows) {
    const description = text(cellAt(row, m, 'description')) ?? ''
    const supplier = text(cellAt(row, m, 'supplier')) ?? ''
    const planned = toNumber(cellAt(row, m, 'planned')) ?? 0
    if (!description && !supplier && !planned) continue
    records.push({
      id: text(cellAt(row, m, 'id')) ?? `B${String(++n).padStart(3, '0')}`,
      category: text(cellAt(row, m, 'category')) ?? project.lists.budgetCategories.at(-1) ?? '',
      supplier,
      description,
      planned,
      committed: toNumber(cellAt(row, m, 'committed')) ?? 0,
      actual: toNumber(cellAt(row, m, 'actual')) ?? 0,
      dueDate: parseDate(cellAt(row, m, 'dueDate')),
      paymentStatus: pick(cellAt(row, m, 'paymentStatus'), PAYMENT) ?? 'Not due',
      invoiceNo: text(cellAt(row, m, 'invoiceNo')),
      notes: text(cellAt(row, m, 'notes')),
    })
  }
  return { records, warnings: [], unmapped: m.unmapped }
}

export function readRisks(table: Table, project: Project): ReadResult<Risk> {
  const m = mapHeaders('risks', table.headers)
  const records: Risk[] = []
  let n = project.risks.length
  for (const row of table.rows) {
    const description = text(cellAt(row, m, 'description')) ?? ''
    const title = text(cellAt(row, m, 'title'))
    if (!description && !title) continue
    records.push({
      id: text(cellAt(row, m, 'id')) ?? `R-${String(++n).padStart(3, '0')}`,
      type: pick(cellAt(row, m, 'type'), RISK_TYPE) ?? 'Risk',
      title,
      description,
      area: text(cellAt(row, m, 'area')) ?? '',
      probability: pick(cellAt(row, m, 'probability'), LEVELS) ?? 'Medium',
      impact: pick(cellAt(row, m, 'impact'), LEVELS) ?? 'Medium',
      owner: text(cellAt(row, m, 'owner')) ?? '',
      mitigation: text(cellAt(row, m, 'mitigation')) ?? '',
      dueDate: parseDate(cellAt(row, m, 'dueDate')),
      status: pick(cellAt(row, m, 'status'), RISK_STATUS) ?? 'Open',
      comment: text(cellAt(row, m, 'comment')),
    })
  }
  return { records, warnings: [], unmapped: m.unmapped }
}
