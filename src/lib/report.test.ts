import { describe, expect, it } from 'vitest'
import { WORKSPACE_SCHEMA_VERSION } from '../types'
import { addDays, buildRoadmap, buildStatusReport, defaultPeriod } from './report'
import { createSampleWorkspace, parseAnyFile, serializeWorkspace } from '../domain/workspace'

const ws = createSampleWorkspace()
const project = ws.projects[0]

describe('status report', () => {
  const r = buildStatusReport(project, ws.calendar, { from: '2026-07-01', to: '2026-08-31', today: new Date(2026, 7, 31) })

  it('lists tasks finished in the period and the next ones', () => {
    expect(r.done.map((t) => t.name)).toEqual(['Tender bids submission period 2nd round', 'Clarification rounds with suppliers'])
    expect(r.next.map((t) => t.name)).toContain('Tender bids evaluation') // in progress, finishes after the period
    expect(r.next.map((t) => t.name)).toContain('Decision')
    expect(r.period.nextTo).toBe(addDays('2026-08-31', 61))
  })

  it('computes finish variance against the baseline and the budget with approved changes', () => {
    expect(r.finish).toBe('2028-01-29')
    expect(r.finishVariance).toBe(0)
    expect(r.budget.current).toBe(project.info.budget) // CR-001 has no cost, CR-002 is open
    expect(r.budget.variance).toBe(r.budget.current - r.budget.forecast)
    expect(r.late.map((x) => x.task.id)).toEqual([]) // t8 finished early vs baseline
  })

  it('ranks open risks and issues by exposure and finds pending changes', () => {
    expect(r.risks.map((x) => x.id)).toEqual(['R-001', 'R-002'])
    expect(r.changes.open.map((c) => c.id)).toEqual(['CR-002'])
    expect(r.texts.escalations).toContain('CR-002')
    expect(r.texts.achievements.split('\n')).toHaveLength(2)
  })

  it('takes approved change cost into the current budget', () => {
    const p = { ...project, changes: project.changes.map((c) => (c.id === 'CR-002' ? { ...c, status: 'Approved' as const } : c)) }
    expect(buildStatusReport(p, ws.calendar, { from: '2026-10-01', to: '2026-10-28' }).budget.current).toBe(project.info.budget + 1_800_000)
  })

  it('starts the default period the day after the last saved report', () => {
    const p = { ...project, statusReports: [{ date: '2026-10-14' } as never] }
    expect(defaultPeriod(p, new Date(2026, 9, 28))).toEqual({ from: '2026-10-15', to: '2026-10-28' })
    expect(defaultPeriod(project, new Date(2026, 9, 28))).toEqual({ from: '2026-10-15', to: '2026-10-28' })
  })
})

describe('roadmap', () => {
  it('uses Mgmt export tasks in Mgmt order, grouped by phase in the configured order', () => {
    const rm = buildRoadmap(project, ws.calendar, 'phase')
    expect(rm.lanes.map((l) => l.name)).toEqual(['INITIATION', 'PLANNING', 'REALIZATION', 'CLOSING'])
    expect(rm.lanes[0].items.map((i) => i.id)).toEqual(['t1', 't2', 't3'])
    expect(rm.lanes.flatMap((l) => l.items).some((i) => i.milestone)).toBe(true)
    expect(rm.start).toBe('2025-08-29')
  })

})

describe('schema 6 migration', () => {
  it('adds report settings and an empty report history', () => {
    const raw = JSON.parse(serializeWorkspace(ws))
    delete raw.reportSettings
    delete raw.projects[0].statusReports
    raw.schemaVersion = 5
    const parsed = parseAnyFile(JSON.stringify(raw))
    if (parsed.kind !== 'workspace') throw new Error('workspace expected')
    expect(parsed.workspace.reportSettings.accentColor).toMatch(/^#/)
    expect(parsed.workspace.projects[0].statusReports).toEqual([])
    expect(parsed.workspace.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION)
  })
})
