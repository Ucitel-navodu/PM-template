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
    expect(s().workspace.projects.find((p) => p.id === first)!.risks).toHaveLength(1) // sample has 1
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
  })

  it('goes Red when the forecast exceeds the approved budget', () => {
    const p = createBlankProject('B')
    p.info.budget = 100
    p.budget = [{ id: 'B001', category: 'Other', supplier: '', description: '', planned: 200, committed: 0, actual: 0, paymentStatus: 'Not due' }]
    expect(summarizeProject(p, createSampleWorkspace().calendar).rag).toBe('Red')
  })
})
