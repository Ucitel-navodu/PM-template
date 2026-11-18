import { describe, expect, it } from 'vitest'
import { createBlankProject } from '../../domain/workspace'
import { defaultLists } from '../../data/settings'
import { budgetByCostType } from '../changes'
import { moveSubtree } from '../schedule/tree'
import type { Task } from '../../types'
import { readConfigLists, readProjectInfo } from './tables'
import { applyFilePlan, planTables, readTableFile, tableOfSheet } from './workbook'
import { writeXlsx } from './xlsx'

describe('original Excel template', () => {
  const sheet = {
    name: 'TASKS',
    rows: [
      ['Project Manager Template – TASKS'],
      [],
      ['Generated', '1.1.2026', 'Start', 'x'],
      ['ID', 'Task Name', 'Phase', 'Owner', 'Current Start', 'Current Finish', '% Complete', 'Status'],
      [1, 'Analýza', 'Analysis', 'Jana', '2.3.2026', '6.3.2026', 0.5, 'In progress'],
      [2, 'Návrh', 'Design', 'Petr', '9.3.2026', '13.3.2026', 0, 'Not started'],
    ],
  }
  it('finds the header row under title rows', () => {
    const t = tableOfSheet(sheet, 'tasks')
    expect(t.headers[1]).toBe('Task Name')
    expect(t.rows).toHaveLength(2)
  })

  it('keeps a plain sheet (headers in row 1) as it was', () => {
    const t = tableOfSheet({ name: 'TASKS', rows: [['Task Name', 'Owner', 'Status'], ['A', 'x', 'Done']] }, 'tasks')
    expect(t.headers).toEqual(['Task Name', 'Owner', 'Status'])
    expect(t.rows).toHaveLength(1)
  })

  it('reads the project card and the lists', () => {
    const info = readProjectInfo([['PROJECT DASHBOARD'], ['Project Name:', null, 'CRM upgrade'], ['Project ID', 'P-42', null, 'ITPM', 'Jan Novák'], ['Start', 46082], ['Budget', '1 250 000 Kč'], ['Currency', 'CZK']])
    expect(info).toEqual({ projectName: 'CRM upgrade', projectId: 'P-42', itpm: 'Jan Novák', start: '2026-03-01', budget: 1250000, currency: 'CZK' })
    expect(readConfigLists([['CONFIG'], ['Phases', 'x', 'Budget Categories'], ['Init', 1, 'HW'], ['Build', 2, 'SW'], [null, 3, 'Services']])).toEqual({ phases: ['Init', 'Build'], budgetCategories: ['HW', 'SW', 'Services'] })
  })

  it('imports an .xlsm-like workbook: tasks, CAPEX/OPEX budget, project card, new lists', async () => {
    const bytes = await writeXlsx([
      { name: 'DASHBOARD', headers: ['Project Dashboard'], rows: [['Project Name', 'CRM upgrade'], ['Budget', 900000]], plain: true },
      { name: 'TASKS', headers: ['My tasks'], rows: sheet.rows.slice(2) as never, plain: true },
      { name: 'BUDGET', headers: ['Budget overview'], rows: [[], ['ID', 'Category', 'Capex/Opex', 'Description', 'Planned', 'Actual'], ['B1', 'HW/SW', 'capex', 'Servery', 500000, 100000], ['B2', 'Services', 'OPEX', 'Podpora', 200000, 0]], plain: true },
      { name: 'CONFIG', headers: ['Phases'], rows: [['Analysis'], ['Design'], ['Rollout']], plain: true },
    ])
    const { inputs, extras, source } = await readTableFile('sablona.xlsm', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, () => '')
    expect(inputs.map((i) => i.kind).sort()).toEqual(['budget', 'tasks'])
    const base = createBlankProject('x', defaultLists)
    const plan = planTables(base, inputs, source, 'sablona.xlsm', { calendar: { workingDays: [1, 2, 3, 4, 5], holidays: [] } } as never, extras)
    expect(plan.tasks?.added).toHaveLength(2)
    expect(plan.info).toEqual({ projectName: 'CRM upgrade', budget: 900000 })
    const p = applyFilePlan(base, plan, 'keep', 'test')
    expect(p.info.projectName).toBe('CRM upgrade')
    expect(p.budget.map((b) => b.costType)).toEqual(['CAPEX', 'OPEX'])
    expect(p.lists.phases).toEqual(expect.arrayContaining(['Analysis', 'Design', 'Rollout']))
    expect(p.tasks.map((t) => t.name)).toEqual(['Analýza', 'Návrh'])
  })
})

describe('CAPEX / OPEX totals', () => {
  it('splits the budget by cost type', () => {
    const r = budgetByCostType([
      { costType: 'CAPEX', planned: 100, committed: 120, actual: 50 },
      { costType: 'OPEX', planned: 30, committed: 0, actual: 40 },
      { planned: 5, committed: 0, actual: 0 },
    ])
    expect(r.CAPEX).toEqual({ planned: 100, committed: 120, actual: 50, forecast: 120 })
    expect(r.OPEX.forecast).toBe(40)
    expect(r.none.forecast).toBe(5)
  })
})

describe('drag & drop reorder', () => {
  const t = (id: string, outlineLevel = 1) => ({ id, outlineLevel }) as Task
  const list = () => [t('a'), t('a1', 2), t('b'), t('c'), t('c1', 2)]
  const ids = (x: Task[]) => x.map((i) => `${i.id}:${i.outlineLevel}`).join(' ')
  it('moves a task with its subtree down (after the target subtree) and up (before the target)', () => {
    expect(ids(moveSubtree(list(), 'a', 'c'))).toBe('b:1 c:1 c1:2 a:1 a1:2')
    expect(ids(moveSubtree(list(), 'c', 'a'))).toBe('c:1 c1:2 a:1 a1:2 b:1')
  })
  it('takes the level of the target and refuses its own subtree', () => {
    expect(ids(moveSubtree(list(), 'b', 'a1'))).toBe('a:1 b:2 a1:2 c:1 c1:2')
    const l = list()
    expect(moveSubtree(l, 'a', 'a1')).toBe(l)
  })
})
