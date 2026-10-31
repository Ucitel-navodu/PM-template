import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkspaceStore } from './workspaceStore'
import { createBlankProject, createSampleWorkspace } from '../domain/workspace'
import { summarizeProject } from '../lib/portfolio'

const s = () => useWorkspaceStore.getState()
const active = () => s().workspace.projects.find((p) => p.id === s().activeProjectId)!

beforeEach(() => {
  s().setReadOnly(false)
  s().replaceWorkspace(createSampleWorkspace())
})

describe('workspace store', () => {
  it('propagates a phase rename to all tasks', () => {
    const before = active().tasks.filter((t) => t.phase === 'PLANNING').length
    s().renameListItem('phases', 'PLANNING', 'PLÁNOVÁNÍ')
    expect(active().lists.phases).toContain('PLÁNOVÁNÍ')
    expect(active().tasks.filter((t) => t.phase === 'PLÁNOVÁNÍ')).toHaveLength(before)
  })

  it('blocks every edit in read-only mode', () => {
    const snapshot = s().workspace
    s().setReadOnly(true)
    s().updateItem('tasks', active().tasks[0].id, { name: 'hacked' })
    s().addProject(createBlankProject('X'))
    s().updateCalendar({ workingDays: [] })
    expect(s().workspace).toBe(snapshot)
  })

  it('undoes and redoes edits', () => {
    const id = active().tasks[0].id
    const original = active().tasks[0].name
    s().updateItem('tasks', id, { name: 'Changed' })
    useWorkspaceStore.temporal.getState().undo()
    expect(active().tasks.find((t) => t.id === id)!.name).toBe(original)
    useWorkspaceStore.temporal.getState().redo()
    expect(active().tasks.find((t) => t.id === id)!.name).toBe('Changed')
  })

  it('keeps edits on the active project only', () => {
    const first = s().activeProjectId
    s().addProject(createBlankProject('Second'))
    expect(s().activeProjectId).not.toBe(first)
    s().addItem('risks', { id: 'R-001', type: 'Risk', area: '', description: 'x', probability: 'Low', impact: 'Low', owner: '', mitigation: '', status: 'Open' })
    expect(active().risks).toHaveLength(1)
    expect(s().workspace.projects.find((p) => p.id === first)!.risks).toHaveLength(5) // sample RAID log has 5
  })

  it('re-selects a project when undo removes the active one', () => {
    s().addProject(createBlankProject('Temp'))
    useWorkspaceStore.temporal.getState().undo()
    expect(s().workspace.projects.some((p) => p.id === s().activeProjectId)).toBe(true)
  })

  it('never leaves the workspace without a project', () => {
    for (const p of [...s().workspace.projects]) s().deleteProject(p.id)
    expect(s().workspace.projects).toHaveLength(1)
    expect(s().activeProjectId).toBe(s().workspace.projects[0].id)
  })

  it('does not record the save bookkeeping as an undo step', () => {
    const past = useWorkspaceStore.temporal.getState().pastStates.length
    s().markSaved(7, '2026-10-23T10:00:00Z', 'Tester')
    expect(s().workspace.revision).toBe(7)
    expect(useWorkspaceStore.temporal.getState().pastStates.length).toBe(past)
  })
})

describe('portfolio summary', () => {
  it('rates the sample project and computes progress', () => {
    const ws = createSampleWorkspace()
    const sum = summarizeProject(ws.projects[0], ws.calendar, new Date(2026, 9, 23))
    expect(['Red', 'Amber', 'Green']).toContain(sum.rag)
    expect(sum.progress).toBeGreaterThan(0)
    expect(sum.progress).toBeLessThan(1)
    expect(sum.openRisks).toBe(1)
    expect(sum.openIssues).toBe(1)
    expect(sum.pendingChanges).toBe(1)
  })

  it('goes Red when the forecast exceeds the approved budget', () => {
    const p = createBlankProject('B')
    p.info.budget = 100
    p.budget = [{ id: 'B001', category: 'Other', supplier: '', description: '', planned: 200, committed: 0, actual: 0, paymentStatus: 'Not due' }]
    expect(summarizeProject(p, createSampleWorkspace().calendar).rag).toBe('Red')
  })
})

describe('governance in the store', () => {
  it('writes an audit entry with the user name and lets undo remove it', async () => {
    const { usePrefsStore } = await import('./prefsStore')
    usePrefsStore.getState().setUserName('Jana Testová')
    const before = active().auditLog.length
    s().updateTask('t11', { owner: 'Někdo' })
    const last = active().auditLog.at(-1)!
    expect(active().auditLog.length).toBe(before + 1)
    expect(last).toMatchObject({ user: 'Jana Testová', entity: 'task', field: 'owner', new: 'Někdo' })
    useWorkspaceStore.temporal.getState().undo()
    expect(active().auditLog.length).toBe(before)
  })

  it('does not log dates the scheduler recalculated', () => {
    const id = s().addTask({ name: 'A', duration: 2 })
    const b = s().addTask({ name: 'B', duration: 1, dependencies: [{ predId: id, type: 'FS', lag: 0 }] })
    const n = active().auditLog.length
    s().updateTask(id, { duration: 5 })
    const added = active().auditLog.slice(n)
    expect(added.map((e) => e.field)).toEqual(['duration'])
    expect(active().tasks.find((t) => t.id === b)!.currentStart).toBeTruthy()
  })

  it('approving a change request re-baselines and logs a decision', () => {
    s().decideChange('CR-002', true, { baseline: true, decision: true })
    const p = active()
    expect(p.changes.find((c) => c.id === 'CR-002')).toMatchObject({ status: 'Approved', decidedBy: 'Jana Testová' })
    expect(p.baselines.at(-1)!.name).toContain('CR-002')
    expect(p.risks.at(-1)).toMatchObject({ type: 'Decision', linkedChangeId: 'CR-002' })
    expect(p.auditLog.at(-1)!.entity).toBe('raid')
  })

  it('renaming a status renames it on the tasks', () => {
    s().renameStatus('Done', 'Hotovo')
    expect(active().tasks.filter((t) => t.status === 'Hotovo').length).toBeGreaterThan(0)
    expect(active().tasks.some((t) => t.status === 'Done')).toBe(false)
    expect(active().lists.statuses.find((x) => x.name === 'Hotovo')!.kind).toBe('Done')
  })
})

describe('import in the store', () => {
  it('is its own undo step even right after another edit', async () => {
    const { planTaskImport } = await import('../lib/import/plan')
    s().updateTask('t11', { owner: 'Hned předtím' })
    const imported = [{ key: '1', uid: '1', name: 'Importovaný úkol', outlineLevel: 1, links: [] }]
    const tasks = planTaskImport(active(), imported, { source: 'msp', fileName: 'x.xml', matchedBy: 'uid' }, { baseline: false, autoSchedule: false })
    s().importPlan({ source: 'msp', fileName: 'x.xml', tasks, warnings: [], unmapped: [] }, 'keep')
    expect(active().tasks.some((t) => t.name === 'Importovaný úkol')).toBe(true)
    expect(active().importLog.at(-1)).toMatchObject({ source: 'msp', fileName: 'x.xml', added: 1 })
    useWorkspaceStore.temporal.getState().undo()
    expect(active().tasks.some((t) => t.name === 'Importovaný úkol')).toBe(false)
    expect(active().tasks.find((t) => t.id === 't11')!.owner).toBe('Hned předtím') // the earlier edit stays
  })
})
