import { describe, expect, it } from 'vitest'
import { appendAudit, diffProject } from './audit'
import { approvedImpact } from './changes'
import { statusKind, statusOfKind } from './status'
import { computeHealth } from './health'
import { createSampleProject } from '../domain/workspace'
import { toDateKey } from './dates'
import type { AuditEntry, Task } from '../types'

const AT = '2026-10-23T10:00:00.000Z'

describe('audit diff', () => {
  const base = createSampleProject()

  it('records create, update and delete per field', () => {
    const t = base.tasks.find((x) => x.id === 't10')!
    const after = {
      ...base,
      tasks: [
        ...base.tasks.filter((x) => x.id !== 't1').map((x) => (x.id === 't10' ? { ...x, owner: 'J. Novák', percentComplete: 0.5 } : x)),
        { ...t, id: 'new', no: 99, name: 'Nový' },
      ],
    }
    const log = diffProject(base, after, 'Tester', AT)
    expect(log.filter((e) => e.action === 'update').map((e) => e.field).sort()).toEqual(['owner', 'percentComplete'])
    expect(log.find((e) => e.field === 'owner')).toMatchObject({ user: 'Tester', entity: 'task', entityId: 't10', old: t.owner, new: 'J. Novák', label: `#${t.no} ${t.name}` })
    expect(log.some((e) => e.action === 'create' && e.entityId === 'new')).toBe(true)
    expect(log.some((e) => e.action === 'delete' && e.entityId === 't1')).toBe(true)
  })

  it('logs project info and RAID / change request edits, ignores bookkeeping', () => {
    const after = {
      ...base,
      updatedAt: 'x',
      info: { ...base.info, budget: 1 },
      risks: base.risks.map((r) => (r.id === 'R-001' ? { ...r, status: 'Closed' as const, lastUpdate: '2030-01-01' } : r)),
      changes: base.changes.map((c) => (c.id === 'CR-002' ? { ...c, status: 'Approved' as const } : c)),
    }
    const log = diffProject(base, after, 'T', AT)
    expect(log.map((e) => `${e.entity}:${e.field}`).sort()).toEqual(['change:status', 'project:budget', 'raid:status'])
  })

  it('merges consecutive edits of one field and drops a change that was reverted', () => {
    const e = (at: string, old: string, nw: string): AuditEntry => ({ at, user: 'A', entity: 'task', entityId: 't', label: 'x', action: 'update', field: 'name', old, new: nw })
    let log = appendAudit([], [e('2026-10-23T10:00:00Z', 'Ab', 'Abc')])
    log = appendAudit(log, [e('2026-10-23T10:00:30Z', 'Abc', 'Abcd')])
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ old: 'Ab', new: 'Abcd' })
    log = appendAudit(log, [e('2026-10-23T10:05:00Z', 'Abcd', 'X')]) // outside the 2-minute window
    expect(log).toHaveLength(2)
    log = appendAudit(log, [e('2026-10-23T10:05:10Z', 'X', 'Abcd')]) // typed back
    expect(log).toHaveLength(1)
  })
})

describe('configurable statuses', () => {
  const statuses = [
    { name: 'Backlog', kind: 'Not started' as const },
    { name: 'Testování', kind: 'In progress' as const },
    { name: 'Hotovo', kind: 'Done' as const },
  ]
  it('resolves the meaning of a custom status', () => {
    expect(statusKind('Testování', statuses)).toBe('In progress')
    expect(statusKind('Done', statuses)).toBe('Done') // built-in name still understood
    expect(statusKind('Neznámý', statuses)).toBe('Not started')
    expect(statusOfKind('Done', statuses)).toBe('Hotovo')
  })
  it('keeps the Health formula on the meaning, not the name', () => {
    const d = (n: number) => toDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + n))
    const task = { name: 'x', status: 'Testování', percentComplete: 0.1, currentStart: d(-10), currentFinish: d(10) } as Task
    const builtIn = computeHealth({ ...task, status: 'In progress' })
    expect(computeHealth(task, { orangeTolerance: 0.1, redTolerance: 0.25, statuses })).toBe(builtIn)
    expect(computeHealth({ ...task, status: 'Hotovo', percentComplete: 1, currentFinish: d(-1) }, { orangeTolerance: 0.1, redTolerance: 0.25, statuses })).toBe('Green')
  })
})

describe('change requests', () => {
  it('counts approved, implemented and closed requests towards the budget', () => {
    const cr = (status: string, cost: number) => ({ status, impactCost: cost, impactDays: 1 }) as never
    expect(approvedImpact([cr('Approved', 100), cr('Implemented', 50), cr('Open', 1000), cr('Rejected', 7), cr('Closed', 1)])).toEqual({ days: 3, cost: 151 })
  })
})
