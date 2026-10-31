import { describe, expect, it } from 'vitest'
import { decodeText, detectDelimiter, parseCsv, csvToTable } from './csv'
import { excelSerial, fromExcelSerial, readXlsx, writeXlsx } from './xlsx'
import { parseDate } from './tables'
import { applyFilePlan, exportWorkbook, planTables, readTableFile } from './workbook'
import { createSampleWorkspace, createBlankProject } from '../../domain/workspace'

const ws = createSampleWorkspace()
const sample = ws.projects[0]
const opts = { baseline: true, autoSchedule: false }
const decode = (b: ArrayBuffer) => decodeText(b)
const buf = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer

describe('CSV', () => {
  it('detects the delimiter and handles quotes, doubled quotes and newlines inside fields', () => {
    const text = 'Název;Popis\r\n"A; B";"řekl ""ano"""\r\nC;"řádek1\nřádek2"\r\n'
    expect(detectDelimiter(text)).toBe(';')
    expect(parseCsv(text)).toEqual([['Název', 'Popis'], ['A; B', 'řekl "ano"'], ['C', 'řádek1\nřádek2']])
  })
  it('decodes UTF-8 with BOM and falls back to Windows-1250', () => {
    const utf8 = new TextEncoder().encode('﻿Úkol;Stav\n')
    expect(decodeText(utf8.buffer as ArrayBuffer)).toBe('Úkol;Stav\n')
    const cp1250 = Uint8Array.from([0xda, 0x6b, 0x6f, 0x6c]) // "Úkol" in Windows-1250 (invalid UTF-8)
    expect(decodeText(cp1250.buffer as ArrayBuffer)).toBe('Úkol')
  })
})

describe('dates', () => {
  it('parses ISO, Czech, US and Excel serial dates without time-zone shifts', () => {
    expect(parseDate('2026-11-09')).toBe('2026-11-09')
    expect(parseDate('9.11.2026')).toBe('2026-11-09')
    expect(parseDate('9. 11. 2026')).toBe('2026-11-09')
    expect(parseDate('11/30/2026')).toBe('2026-11-30')
    expect(parseDate(46335)).toBe('2026-11-09')
    expect(parseDate('nesmysl')).toBeUndefined()
    expect(parseDate('31.31.2026')).toBeUndefined()
    expect(parseDate('30.2.2026')).toBeUndefined()
  })
  it('converts Excel serials both ways across the DST switch', () => {
    for (const d of [new Date(2026, 9, 24), new Date(2026, 9, 25), new Date(2026, 9, 26), new Date(2026, 2, 29)]) {
      expect(fromExcelSerial(excelSerial(d)).getTime()).toBe(d.getTime())
    }
    expect(excelSerial(new Date(2026, 10, 9))).toBe(46335)
  })
})

describe('xlsx writer + reader', () => {
  it('round-trips text, numbers, dates and special characters', async () => {
    const bytes = await writeXlsx([{ name: 'List <1>', headers: ['Název', 'Částka', 'Datum'], rows: [['Příliš & "žluťoučký" <kůň>', 1234.5, new Date(2026, 10, 9)], ['druhý', null, undefined]] }])
    const sheets = await readXlsx(buf(bytes))
    expect(sheets[0].name).toBe('List <1>')
    expect(sheets[0].rows[0]).toEqual(['Název', 'Částka', 'Datum'])
    expect(sheets[0].rows[1]).toEqual(['Příliš & "žluťoučký" <kůň>', 1234.5, 46335])
    expect(sheets[0].rows[2][0]).toBe('druhý')
  })
  it('rejects files that are not xlsx', async () => {
    await expect(readXlsx(new TextEncoder().encode('not a zip').buffer as ArrayBuffer)).rejects.toThrow(/xlsx/)
  })
})

describe('Excel export -> import round trip', () => {
  it('re-importing the export into the same project changes nothing', async () => {
    const bytes = await exportWorkbook(sample, ws.calendar)
    const { source, inputs } = await readTableFile('tmp.xlsx', buf(bytes), decode)
    expect(source).toBe('excel')
    expect(inputs.map((i) => i.kind).sort()).toEqual(['budget', 'milestones', 'risks', 'tasks'])
    const plan = planTables(sample, inputs, source, 'tmp.xlsx', opts)
    expect(plan.tasks!.added).toHaveLength(0)
    expect(plan.tasks!.updated.map((u) => `${u.task.name}: ${u.changes.map((c) => c.field).join(',')}`)).toEqual([])
    expect(plan.tasks!.removed).toHaveLength(0)
    expect(plan.milestones).toMatchObject({ added: [], updated: [] })
    expect(plan.budget).toMatchObject({ added: [], updated: [] })
    expect(plan.risks).toMatchObject({ added: [], updated: [] })
  })

  it('importing the export into an empty project rebuilds hierarchy, links, dates and RAID', async () => {
    const bytes = await exportWorkbook(sample, ws.calendar)
    const { source, inputs } = await readTableFile('tmp.xlsx', buf(bytes), decode)
    const blank = createBlankProject('Copy')
    const plan = planTables(blank, inputs, source, 'tmp.xlsx', opts)
    const p = applyFilePlan(blank, plan, 'keep', 'T')
    expect(p.tasks).toHaveLength(sample.tasks.length)
    const keys = (t: (typeof sample.tasks)[number]) => [t.name, t.outlineLevel, t.currentStart, t.currentFinish, t.milestone, t.status, t.percentComplete, t.phase]
    expect(p.tasks.map(keys)).toEqual(sample.tasks.map(keys))
    const links = (project: typeof sample) => project.tasks.map((t) => t.dependencies.map((d) => `${project.tasks.find((x) => x.id === d.predId)!.name}${d.type}${d.lag}`))
    expect(links(p)).toEqual(links(sample))
    expect(p.milestones).toHaveLength(sample.milestones.length)
    expect(p.risks.map((r) => r.id)).toEqual(sample.risks.map((r) => r.id))
    expect(p.budget[0].planned).toBe(sample.budget[0].planned)
    expect(p.lists.phases).toEqual(expect.arrayContaining(sample.lists.phases)) // phases from the file join the lists
  })
})

describe('CSV import', () => {
  it('reads a Czech Excel export (semicolons, d.m.yyyy, CZ headers) and reports unmapped columns', async () => {
    const csv = '﻿Číslo;Název úkolu;Fáze;Stav;Vlastník;Aktuální start;Aktuální konec;% dokončení;Předchůdci;Něco navíc\n1;Analýza;INITIATION;Done;Jana;2.11.2026;6.11.2026;100;;x\n2;Vývoj;REALIZATION;In progress;Petr;9.11.2026;20.11.2026;40 %;1;y\n'
    const { source, inputs } = await readTableFile('ukoly.csv', new TextEncoder().encode(csv).buffer as ArrayBuffer, decode)
    expect(source).toBe('csv')
    expect(inputs[0].kind).toBe('tasks')
    const plan = planTables(createBlankProject('X'), inputs, source, 'ukoly.csv', opts)
    expect(plan.unmapped[0].columns).toEqual(['Něco navíc'])
    const [a, b] = plan.tasks!.added
    expect(a).toMatchObject({ name: 'Analýza', currentStart: '2026-11-02', currentFinish: '2026-11-06', status: 'Done', percentComplete: 1 })
    expect(b).toMatchObject({ currentStart: '2026-11-09', percentComplete: 0.4, owner: 'Petr' })
    expect(b.dependencies).toEqual([{ predId: a.id, type: 'FS', lag: 0 }])
  })

  it('warns about invalid dates and missing name column instead of failing', () => {
    const t = csvToTable('Task Name,Start\nA,31.31.99999\n')
    expect(planTables(createBlankProject('X'), [{ table: t, kind: 'tasks' }], 'csv', 'a.csv', opts).tasks!.warnings.join()).toContain('není platné datum')
    const noName = csvToTable('Foo,Bar\n1,2\n')
    expect(planTables(createBlankProject('X'), [{ table: noName, kind: 'tasks' }], 'csv', 'a.csv', opts).tasks!.warnings.join()).toContain('Chybí sloupec')
  })

  it('a second import of the same file updates by name instead of duplicating', () => {
    const t = csvToTable('Task Name,Percent Complete\nA,10\nB,20\n')
    const first = applyFilePlan(createBlankProject('X'), planTables(createBlankProject('X'), [{ table: t, kind: 'tasks' }], 'csv', 'a.csv', opts), 'keep', 'T')
    const t2 = csvToTable('Task Name,Percent Complete\nA,50\nB,20\nC,0\n')
    const plan = planTables(first, [{ table: t2, kind: 'tasks' }], 'csv', 'a.csv', opts)
    expect(plan.tasks!.added.map((x) => x.name)).toEqual(['C'])
    expect(plan.tasks!.updated.map((u) => u.task.name)).toEqual(['A'])
    expect(plan.tasks!.unchanged.map((x) => x.name)).toEqual(['B'])
  })
})
