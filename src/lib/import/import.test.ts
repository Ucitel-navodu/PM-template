import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseMspXml, ImportError, durationHours } from './msp'
import { applyImportPlan, fromMsp, planTaskImport, type PlanOptions } from './plan'
import { createBlankProject } from '../../domain/workspace'
import { applySchedule } from '../schedule/cpm'
import { defaultCalendar } from '../../data/settings'

const xml = readFileSync('tests/fixtures/sample-msp.xml', 'utf8')
const opts: PlanOptions = { baseline: true, autoSchedule: false }
const cal = { ...defaultCalendar, holidays: [] }

function importInto(project: ReturnType<typeof createBlankProject>, text: string, choice: 'keep' | 'cancel' | 'delete' = 'keep') {
  const parsed = parseMspXml(text)
  const plan = planTaskImport(project, fromMsp(parsed), { source: 'msp', fileName: 'a.xml', matchedBy: 'uid', warnings: parsed.warnings }, opts)
  return { plan, project: applySchedule(applyImportPlan(project, plan, choice, 'T'), cal) }
}

describe('MS Project XML parser', () => {
  const p = parseMspXml(xml)
  it('reads tasks, skips the project row (UID 0) and decodes entities', () => {
    expect(p.tasks.map((t) => t.uid)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
    expect(p.tasks[1].name).toBe('Analýza & návrh')
    expect(p.tasks[0]).toMatchObject({ summary: true, outlineLevel: 1 })
    expect(p.tasks[1]).toMatchObject({ outlineLevel: 2, start: '2026-11-02', finish: '2026-11-06', duration: 5, percent: 1 })
  })
  it('converts durations to working days and keeps notes, baseline, resources', () => {
    expect(p.tasks[3].duration).toBe(9)
    expect(p.tasks[2]).toMatchObject({ notes: 'Ruční poznámka z MSP', baselineStart: '2026-11-09', baselineFinish: '2026-11-13', resources: ['Jana Nováková'] })
    expect(durationHours('P1DT4H')).toBe(28)
  })
  it('maps all four link types and lag/lead in working days', () => {
    expect(p.tasks[2].links).toEqual([{ predUid: '2', type: 'FS', lag: 0 }])
    expect(p.tasks[3].links).toEqual([{ predUid: '3', type: 'SS', lag: 1 }])
    expect(p.tasks[4].links).toEqual([{ predUid: '4', type: 'FF', lag: -1 }])
    expect(p.tasks[5].links).toEqual([{ predUid: '4', type: 'SF', lag: 0 }])
  })
  it('reads milestones', () => {
    expect(p.tasks[6]).toMatchObject({ milestone: true, duration: 0, start: '2026-11-30', finish: '2026-11-30', baselineFinish: '2026-11-27' })
  })
  it('rejects non-XML, DTD / entity tricks and files without tasks', () => {
    expect(() => parseMspXml('hello')).toThrow(ImportError)
    expect(() => parseMspXml('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><Project/>')).toThrow(/DTD/)
    expect(() => parseMspXml('<Project xmlns="http://schemas.microsoft.com/project"><Tasks/></Project>')).toThrow(/žádné úkoly/)
    expect(() => parseMspXml('<Other/>')).toThrow(/MS Project/)
  })
  it('warns about links to missing tasks', () => {
    const broken = xml.replace('<PredecessorUID>2</PredecessorUID>', '<PredecessorUID>99</PredecessorUID>')
    const r = parseMspXml(broken)
    expect(r.warnings.join()).toContain('neexistující')
    expect(r.tasks[2].links).toEqual([])
  })
})

describe('MS Project import plan', () => {
  it('first import into an empty project adds everything with hierarchy and links', () => {
    const { plan, project } = importInto(createBlankProject('X'), xml)
    expect(plan.added).toHaveLength(7)
    expect(plan.updated).toHaveLength(0)
    expect(project.tasks.map((t) => t.wbs)).toEqual(['1', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6'])
    expect(project.tasks[2].dependencies).toEqual([{ predId: project.tasks[1].id, type: 'FS', lag: 0 }])
    expect(project.tasks[2]).toMatchObject({ currentStart: '2026-11-09', schedulingMode: 'manual', status: 'In progress', owner: 'Jana Nováková', baselineFinish: '2026-11-13' })
    expect(project.tasks[1].status).toBe('Done')
    expect(project.tasks[0].currentFinish).toBe('2026-11-30') // summary rolls up
    expect(project.importLog).toHaveLength(1)
  })

  it('repeated import updates by UID, keeps the PM\'s own fields, reports removed tasks', () => {
    const first = importInto(createBlankProject('X'), xml).project
    // the PM edits their own fields in the app
    const edited = { ...first, tasks: first.tasks.map((t) => (t.uid === '3' ? { ...t, phase: 'PLANNING', priority: 'Very High', notes: 'moje', mgmtExport: true } : t)) }
    // MS Project: task 3 moved + 100 %, task 5 removed, a new task 8 added
    const changed = xml
      .replace('<Start>2026-11-09T08:00:00</Start><Finish>2026-11-13T17:00:00</Finish><Duration>PT40H0M0S</Duration>\n      <PercentComplete>50', '<Start>2026-11-12T08:00:00</Start><Finish>2026-11-18T17:00:00</Finish><Duration>PT40H0M0S</Duration>\n      <PercentComplete>100')
      .replace(/<Task>\s*<UID>5<\/UID>[\s\S]*?<\/Task>/, '')
      .replace('</Tasks>', '<Task><UID>8</UID><ID>8</ID><Name>Nový úkol</Name><OutlineLevel>2</OutlineLevel><Start>2026-11-23T08:00:00</Start><Finish>2026-11-25T17:00:00</Finish><Duration>PT24H0M0S</Duration></Task></Tasks>')
    const { plan, project } = importInto(edited, changed)
    expect(plan.added.map((t) => t.name)).toEqual(['Nový úkol'])
    expect(plan.removed.map((t) => t.name)).toEqual(['Testování'])
    const upd = plan.updated.find((u) => u.task.uid === '3')!
    expect(upd.changes.map((c) => c.field).sort()).toEqual(['currentFinish', 'currentStart', 'percentComplete', 'status'])
    const t3 = project.tasks.find((t) => t.uid === '3')!
    expect(t3).toMatchObject({ currentStart: '2026-11-12', percentComplete: 1, status: 'Done', phase: 'PLANNING', priority: 'Very High', notes: 'moje', mgmtExport: true })
    // removed task is kept by default, so dependencies to it survive
    expect(project.tasks.some((t) => t.uid === '5')).toBe(true)
    expect(project.importLog).toHaveLength(2)
  })

  it('removed tasks can be cancelled or deleted (links to them are dropped)', () => {
    const first = importInto(createBlankProject('X'), xml).project
    const without5 = xml.replace(/<Task>\s*<UID>5<\/UID>[\s\S]*?<\/Task>/, '')
    expect(importInto(first, without5, 'cancel').project.tasks.find((t) => t.uid === '5')!.status).toBe('Cancelled')
    const deleted = importInto(first, without5, 'delete').project
    expect(deleted.tasks.some((t) => t.uid === '5')).toBe(false)
    expect(deleted.tasks.flatMap((t) => t.dependencies).every((d) => deleted.tasks.some((x) => x.id === d.predId))).toBe(true)
  })

  it('adopts hand-typed tasks with the same name on the first MSP import (no duplicates)', () => {
    const blank = createBlankProject('X')
    const manual = { ...blank, tasks: [{ id: 'm1', no: 1, outlineLevel: 1, wbs: '1', name: 'testování', phase: 'REALIZATION', status: 'Not started', owner: '', percentComplete: 0, schedulingMode: 'manual' as const, dependencies: [], milestone: false, priority: 'Medium', mgmtExport: true }] }
    const { plan, project } = importInto(manual, xml)
    expect(plan.updated.map((u) => u.task.id)).toEqual(['m1'])
    expect(project.tasks.filter((t) => t.name.toLowerCase() === 'testování')).toHaveLength(1)
    expect(project.tasks.find((t) => t.id === 'm1')).toMatchObject({ uid: '5', phase: 'REALIZATION', mgmtExport: true })
  })

  it('the app schedules the imported links like MS Project would (SS+1, FF-1, SF)', () => {
    const { project } = importInto(createBlankProject('X'), xml)
    const auto = applySchedule({ ...project, info: { ...project.info, start: '2026-11-02' }, tasks: project.tasks.map((t) => ({ ...t, schedulingMode: 'auto' as const, currentStart: undefined, currentFinish: undefined })) }, cal)
    const by = (uid: string) => auto.tasks.find((t) => t.uid === uid)!
    expect(by('3').currentStart).toBe('2026-11-09') // FS after Analýza
    expect(by('4').currentStart).toBe('2026-11-10') // SS+1d after Implementace
    expect(by('5').currentFinish).toBe('2026-11-19') // FF-1d after Vývoj (finishes 2026-11-20)
  })
})
