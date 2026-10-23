import { describe, expect, it } from 'vitest'
import { createSampleWorkspace, parseAnyFile, serializeWorkspace, workspaceFromLegacySnapshot, WorkspaceFileError } from './workspace'
import { seedTasks, projectInfo } from '../data/seed'

const legacyV1 = {
  fileType: 'pm-web-project',
  version: 1,
  exportedAt: '2026-10-02T10:00:00Z',
  projectInfo: { ...projectInfo, projectName: 'Legacy v1' },
  tasks: seedTasks.slice(0, 2),
  milestones: [{ id: 'M01', name: 'KoM', paymentTriggerPct: 0.1, paymentAmount: 4500000, paymentStatus: 'Paid' }],
  budget: [],
  risks: [],
}

describe('parseAnyFile', () => {
  it('round-trips a workspace', () => {
    const ws = createSampleWorkspace()
    const parsed = parseAnyFile(serializeWorkspace(ws))
    expect(parsed.kind).toBe('workspace')
    if (parsed.kind === 'workspace') {
      expect(parsed.workspace.projects).toHaveLength(1)
      expect(parsed.workspace.projects[0].tasks).toHaveLength(ws.projects[0].tasks.length)
      expect(parsed.workspace.id).toBe(ws.id)
    }
  })

  it('imports a legacy v1 project export (no settings, no absences)', () => {
    const parsed = parseAnyFile(JSON.stringify(legacyV1))
    expect(parsed.kind).toBe('legacy-project')
    if (parsed.kind !== 'legacy-project') return
    expect(parsed.project.info.projectName).toBe('Legacy v1')
    expect(parsed.project.lists.phases).toContain('INITIATION')
    expect(parsed.absences).toEqual([])
    // The typed amount is derived now (budget x %): the stale field is dropped.
    expect(parsed.project.milestones[0]).not.toHaveProperty('paymentAmount')
  })

  it('splits legacy v2 settings into project lists and workspace calendar', () => {
    const v2 = {
      ...legacyV1,
      version: 2,
      settings: { phases: ['A', 'B'], projectAreas: ['X'], budgetCategories: ['C'], holidays: [{ date: '2026-12-24', name: 'SD' }], workingDays: [1, 2, 3, 4], orangeTolerance: 0.2, redTolerance: 0.4 },
      absences: [{ id: 'a1', person: 'P', type: 'Vacation', from: '2026-10-26', to: '2026-10-30' }],
    }
    const parsed = parseAnyFile(JSON.stringify(v2))
    if (parsed.kind !== 'legacy-project') throw new Error('expected legacy')
    expect(parsed.project.lists.phases).toEqual(['A', 'B'])
    expect(parsed.calendar.workingDays).toEqual([1, 2, 3, 4])
    expect(parsed.calendar.redTolerance).toBe(0.4)
    expect(parsed.absences).toHaveLength(1)
  })

  it('refuses files from a newer app version instead of silently dropping data', () => {
    const ws = { ...createSampleWorkspace(), schemaVersion: 99 }
    expect(() => parseAnyFile(JSON.stringify(ws))).toThrow(/novější verzí/)
  })

  it('rejects non-JSON and foreign JSON with a user-facing error', () => {
    expect(() => parseAnyFile('not json')).toThrow(WorkspaceFileError)
    expect(() => parseAnyFile('{"hello": 1}')).toThrow(WorkspaceFileError)
    expect(() => parseAnyFile('{"fileType":"pm-web-workspace","schemaVersion":3,"id":"x"}')).toThrow(WorkspaceFileError)
  })

  it('tolerates missing optional parts of a workspace', () => {
    const minimal = {
      fileType: 'pm-web-workspace',
      schemaVersion: 3,
      id: 'w1',
      projects: [{ id: 'p1', info: { projectName: 'Min' } }],
    }
    const parsed = parseAnyFile(JSON.stringify(minimal))
    if (parsed.kind !== 'workspace') throw new Error('expected workspace')
    const p = parsed.workspace.projects[0]
    expect(p.tasks).toEqual([])
    expect(p.lists.phases.length).toBeGreaterThan(0)
    expect(parsed.workspace.calendar.workingDays).toEqual([1, 2, 3, 4, 5])
  })
})

describe('workspaceFromLegacySnapshot', () => {
  it('migrates the single-project localStorage data into a one-project workspace', () => {
    const ws = workspaceFromLegacySnapshot({
      projectInfo: { ...projectInfo, projectName: 'From localStorage' },
      tasks: seedTasks,
      settings: { phases: ['P1'], workingDays: [1, 2, 3, 4, 5, 6] },
    })
    expect(ws.projects).toHaveLength(1)
    expect(ws.projects[0].info.projectName).toBe('From localStorage')
    expect(ws.projects[0].lists.phases).toEqual(['P1'])
    expect(ws.calendar.workingDays).toEqual([1, 2, 3, 4, 5, 6])
  })
})
