import type { AuditEntity, AuditEntry, Project } from '../types'

/*
 * Audit trail: who changed what and when, derived by diffing the project
 * before and after a user edit (records keyed by id, compared field by field).
 * The store diffs *before* the scheduler runs, so recalculated dates of
 * auto-scheduled tasks are consequences, not separate log lines.
 */

const COLLECTIONS: { key: 'tasks' | 'milestones' | 'budget' | 'risks' | 'changes'; entity: AuditEntity }[] = [
  { key: 'tasks', entity: 'task' },
  { key: 'milestones', entity: 'milestone' },
  { key: 'budget', entity: 'budget' },
  { key: 'risks', entity: 'raid' },
  { key: 'changes', entity: 'change' },
]

// Bookkeeping and derived values - not user decisions.
const IGNORED = new Set(['updatedAt', 'wbs', 'lastUpdate', 'lastChanged'])

type Rec = Record<string, unknown> & { id: string }

export function formatValue(v: unknown): string {
  if (v === undefined || v === null || v === '') return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return s.length > 200 ? `${s.slice(0, 197)}…` : s
}

function label(entity: AuditEntity, r: Rec): string {
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '')
  switch (entity) {
    case 'task':
      return `#${r.no ?? ''} ${s('name')}`.trim()
    case 'milestone':
      return s('name') || r.id
    case 'budget':
      return s('description') || s('supplier') || r.id
    case 'raid':
      return `${r.id} ${s('title') || s('description')}`.trim()
    case 'change':
      return `${r.id} ${s('title')}`.trim()
    default:
      return r.id
  }
}

export function diffProject(before: Project, after: Project, user: string, at: string): AuditEntry[] {
  const out: AuditEntry[] = []
  const push = (e: Omit<AuditEntry, 'at' | 'user'>) => out.push({ at, user, ...e })

  for (const { key, entity } of COLLECTIONS) {
    const prev = (before[key] ?? []) as unknown as Rec[]
    const next = (after[key] ?? []) as unknown as Rec[]
    if (prev === next) continue
    const prevById = new Map(prev.map((r) => [r.id, r]))
    const nextIds = new Set(next.map((r) => r.id))
    for (const r of next) {
      const old = prevById.get(r.id)
      if (!old) {
        push({ entity, entityId: r.id, label: label(entity, r), action: 'create' })
        continue
      }
      if (old === r) continue
      for (const field of new Set([...Object.keys(old), ...Object.keys(r)])) {
        if (IGNORED.has(field)) continue
        const a = formatValue(old[field])
        const b = formatValue(r[field])
        if (a !== b) push({ entity, entityId: r.id, label: label(entity, r), action: 'update', field, old: a, new: b })
      }
    }
    for (const r of prev) {
      if (!nextIds.has(r.id)) push({ entity, entityId: r.id, label: label(entity, r), action: 'delete' })
    }
  }

  if (before.info !== after.info) {
    for (const field of Object.keys({ ...before.info, ...after.info })) {
      const a = formatValue((before.info as unknown as Record<string, unknown>)[field])
      const b = formatValue((after.info as unknown as Record<string, unknown>)[field])
      if (a !== b) push({ entity: 'project', entityId: after.id, label: after.info.projectName, action: 'update', field, old: a, new: b })
    }
  }
  if (before.lists !== after.lists) {
    for (const field of Object.keys({ ...before.lists, ...after.lists })) {
      const a = formatValue((before.lists as unknown as Record<string, unknown>)[field])
      const b = formatValue((after.lists as unknown as Record<string, unknown>)[field])
      if (a !== b) push({ entity: 'lists', entityId: field, label: field, action: 'update', field, old: a, new: b })
    }
  }
  return out
}

/**
 * Append entries; consecutive edits of the same field by the same person
 * within `windowMs` are merged into one line (typing a name = one change),
 * keeping the original old value.
 */
export function appendAudit(log: AuditEntry[], entries: AuditEntry[], windowMs = 120_000): AuditEntry[] {
  if (entries.length === 0) return log
  const next = [...log]
  for (const e of entries) {
    const last = next[next.length - 1]
    if (
      e.action === 'update' &&
      last &&
      last.action === 'update' &&
      last.user === e.user &&
      last.entity === e.entity &&
      last.entityId === e.entityId &&
      last.field === e.field &&
      new Date(e.at).getTime() - new Date(last.at).getTime() <= windowMs
    ) {
      if (last.old === e.new) next.pop() // changed back: nothing happened
      else next[next.length - 1] = { ...last, at: e.at, new: e.new, label: e.label }
      continue
    }
    next.push(e)
  }
  return next
}
