import { XMLParser } from 'fast-xml-parser'
import type { LinkType } from '../../types'

/*
 * MS Project XML (File > Save As > XML Format), schema
 * http://schemas.microsoft.com/project. Only what the app uses is read.
 * Dates keep their calendar day (the time part is ignored, no time-zone
 * conversion), durations are converted to working days.
 */

export interface MspLink {
  predUid: string
  type: LinkType
  /** Lag in working days (negative = lead). */
  lag: number
}

export interface MspTask {
  uid: string
  name: string
  outlineLevel: number
  wbs?: string
  start?: string
  finish?: string
  /** Working days; 0 for milestones. */
  duration: number
  percent: number // 0..1
  milestone: boolean
  summary: boolean
  manual: boolean
  notes?: string
  baselineStart?: string
  baselineFinish?: string
  constraint?: { type: 'SNET' | 'MSO'; date: string }
  resources: string[]
  links: MspLink[]
}

export interface MspProject {
  name?: string
  start?: string
  finish?: string
  /** Working weekdays of the MSP default calendar are not imported; kept to warn on mismatch. */
  minutesPerDay: number
  tasks: MspTask[]
  warnings: string[]
}

export class ImportError extends Error {}

const MAX_BYTES = 60 * 1024 * 1024

// MSP link type codes: 0 = FF, 1 = FS, 2 = SF, 3 = SS
const LINK_TYPES: Record<string, LinkType> = { '0': 'FF', '1': 'FS', '2': 'SF', '3': 'SS' }

const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v])
const str = (v: unknown): string | undefined => (v === undefined || v === null || v === '' ? undefined : String(v))
const num = (v: unknown, fallback = 0): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
/** `2026-03-02T08:00:00` -> `2026-03-02` (the calendar day as written, no conversion). */
const day = (v: unknown): string | undefined => {
  const s = str(v)
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined
}

/** ISO 8601 duration `PT16H0M0S` / `P2DT4H` -> hours. */
export function durationHours(v: unknown): number {
  const m = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(String(v ?? '').trim())
  if (!m) return 0
  return num(m[1]) * 24 + num(m[2]) + num(m[3]) / 60 + num(m[4]) / 3600
}

export function parseMspXml(text: string): MspProject {
  if (text.length > MAX_BYTES) throw new ImportError('Soubor je příliš velký.')
  const trimmed = text.replace(/^﻿/, '').trim()
  if (!trimmed.startsWith('<')) throw new ImportError('Soubor není XML. V MS Project zvol Soubor › Uložit jako › XML (*.xml).')
  // MS Project never writes a DTD; refusing it closes the XXE / entity-expansion door completely.
  if (/<!DOCTYPE|<!ENTITY/i.test(trimmed)) throw new ImportError('XML s definicí DTD / entit není povolen (bezpečnost).')

  let doc: Record<string, unknown>
  try {
    doc = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      removeNSPrefix: true,
      processEntities: true,
      isArray: (name) => ['Task', 'PredecessorLink', 'Baseline', 'Resource', 'Assignment'].includes(name),
    }).parse(trimmed)
  } catch (e) {
    throw new ImportError(`XML nelze přečíst: ${e instanceof Error ? e.message : e}`)
  }
  const project = doc.Project as Record<string, unknown> | undefined
  if (!project || typeof project !== 'object') throw new ImportError('Soubor není MS Project XML (chybí kořenový prvek Project).')

  const warnings: string[] = []
  const minutesPerDay = num(project.MinutesPerDay, 480) || 480
  const hoursPerDay = minutesPerDay / 60

  const resources = new Map<string, string>()
  for (const r of arr((project.Resources as { Resource?: Record<string, unknown>[] } | undefined)?.Resource)) {
    const uid = str(r.UID)
    const name = str(r.Name)
    if (uid && name) resources.set(uid, name)
  }
  const assignments = new Map<string, string[]>()
  for (const a of arr((project.Assignments as { Assignment?: Record<string, unknown>[] } | undefined)?.Assignment)) {
    const t = str(a.TaskUID)
    const r = resources.get(str(a.ResourceUID) ?? '')
    if (t && r) assignments.set(t, [...(assignments.get(t) ?? []), r])
  }

  const tasks: MspTask[] = []
  const raw = arr((project.Tasks as { Task?: Record<string, unknown>[] } | undefined)?.Task)
  for (const t of raw) {
    const uid = str(t.UID)
    if (!uid || uid === '0') continue // UID 0 = the project summary row
    const name = str(t.Name)
    if (!name) continue // blank rows
    const milestone = str(t.Milestone) === '1'
    const baseline = arr(t.Baseline as Record<string, unknown>[] | undefined).find((b) => str(b.Number) === '0')
    const ctype = str(t.ConstraintType)
    const cdate = day(t.ConstraintDate)
    const constraint = cdate && ctype === '4' ? { type: 'SNET' as const, date: cdate } : cdate && ctype === '2' ? { type: 'MSO' as const, date: cdate } : undefined
    const start = day(t.Start)
    tasks.push({
      uid,
      name,
      outlineLevel: Math.max(1, Math.round(num(t.OutlineLevel, 1))),
      wbs: str(t.WBS),
      start,
      finish: milestone ? start : day(t.Finish),
      duration: milestone ? 0 : Math.round((durationHours(t.Duration) / hoursPerDay) * 100) / 100,
      percent: Math.min(1, Math.max(0, num(t.PercentComplete) / 100)),
      milestone,
      summary: str(t.Summary) === '1',
      manual: str(t.Manual) === '1',
      notes: str(t.Notes),
      baselineStart: day(baseline?.Start),
      baselineFinish: baseline && str(milestone ? baseline.Start : baseline.Finish) ? (milestone ? day(baseline.Start) : day(baseline.Finish)) : undefined,
      constraint,
      resources: assignments.get(uid) ?? [],
      links: arr(t.PredecessorLink as Record<string, unknown>[] | undefined)
        .map((l) => {
          const type = LINK_TYPES[str(l.Type) ?? '1']
          // LinkLag is in tenths of a minute (unless LagFormat says elapsed/percent: treated as working time).
          const lag = Math.round(((num(l.LinkLag) / 10) / minutesPerDay) * 100) / 100
          return { predUid: str(l.PredecessorUID) ?? '', type: type ?? 'FS', lag }
        })
        .filter((l) => l.predUid),
    })
  }
  if (tasks.length === 0) throw new ImportError('V souboru nejsou žádné úkoly.')
  if (new Set(tasks.map((t) => t.uid)).size !== tasks.length) warnings.push('Soubor obsahuje duplicitní UID úkolů – použit je první výskyt.')
  const seen = new Set<string>()
  const unique = tasks.filter((t) => (seen.has(t.uid) ? false : (seen.add(t.uid), true)))
  const uids = new Set(unique.map((t) => t.uid))
  for (const t of unique) {
    const before = t.links.length
    t.links = t.links.filter((l) => uids.has(l.predUid) && l.predUid !== t.uid)
    if (t.links.length < before) warnings.push(`Úkol „${t.name}“: vazba na neexistující úkol byla přeskočena.`)
  }
  if (unique.some((t) => t.links.some((l) => l.lag !== Math.round(l.lag)))) warnings.push('Některé vazby mají posun v částech dne – zaokrouhleno na celé pracovní dny.')
  for (const t of unique) for (const l of t.links) l.lag = Math.round(l.lag)

  return { name: str(project.Name) ?? str(project.Title), start: day(project.StartDate), finish: day(project.FinishDate), minutesPerDay, tasks: unique, warnings }
}
