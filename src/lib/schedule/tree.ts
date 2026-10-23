import type { Task } from '../../types'

/*
 * Outline helpers. Tasks are stored as a flat list in outline order with an
 * outline level, as in MS Project: a task's parent is the nearest previous
 * task with a lower level, and a task with children is a summary task.
 */

export interface OutlineInfo {
  parentId?: string
  childIds: string[]
  wbs: string
  isSummary: boolean
}

export function outline(tasks: Task[]): Map<string, OutlineInfo> {
  const info = new Map<string, OutlineInfo>()
  const stack: Task[] = [] // ancestors of the current position
  const counters: number[] = [] // sibling counter per level
  for (const t of tasks) {
    // Clamp levels so the outline is always valid (max one deeper than the previous task).
    const level = Math.max(1, Math.min(t.outlineLevel || 1, stack.length + 1))
    while (stack.length >= level) stack.pop()
    counters.length = level
    counters[level - 1] = (counters[level - 1] ?? 0) + 1
    const parent = stack[stack.length - 1]
    info.set(t.id, { parentId: parent?.id, childIds: [], wbs: counters.join('.'), isSummary: false })
    if (parent) {
      const p = info.get(parent.id)!
      p.childIds.push(t.id)
      p.isSummary = true
    }
    stack.push(t)
  }
  return info
}

/** Index range [start, end) of a task and all its descendants in the list. */
export function subtreeRange(tasks: Task[], index: number): [number, number] {
  const level = tasks[index].outlineLevel
  let end = index + 1
  while (end < tasks.length && tasks[end].outlineLevel > level) end++
  return [index, end]
}

/** Indent: become a child of the previous sibling (with the whole subtree). */
export function indent(tasks: Task[], id: string): Task[] {
  const i = tasks.findIndex((t) => t.id === id)
  if (i <= 0 || tasks[i - 1].outlineLevel < tasks[i].outlineLevel) return tasks
  const [s, e] = subtreeRange(tasks, i)
  return tasks.map((t, k) => (k >= s && k < e ? { ...t, outlineLevel: t.outlineLevel + 1 } : t))
}

/** Outdent: move one level up with the whole subtree (following siblings stay where they are). */
export function outdent(tasks: Task[], id: string): Task[] {
  const i = tasks.findIndex((t) => t.id === id)
  if (i < 0 || tasks[i].outlineLevel <= 1) return tasks
  const [s, e] = subtreeRange(tasks, i)
  const level = tasks[i].outlineLevel
  // Following siblings would become our children; move our subtree after them instead.
  let after = e
  while (after < tasks.length && tasks[after].outlineLevel >= level) after++
  const moved = tasks.slice(s, e).map((t) => ({ ...t, outlineLevel: t.outlineLevel - 1 }))
  return [...tasks.slice(0, s), ...tasks.slice(e, after), ...moved, ...tasks.slice(after)]
}

/** Move a task (with its subtree) before/after its previous/next sibling. */
export function move(tasks: Task[], id: string, dir: -1 | 1): Task[] {
  const i = tasks.findIndex((t) => t.id === id)
  if (i < 0) return tasks
  const level = tasks[i].outlineLevel
  const [s, e] = subtreeRange(tasks, i)
  if (dir === 1) {
    if (e >= tasks.length || tasks[e].outlineLevel !== level) return tasks
    const [, ne] = subtreeRange(tasks, e)
    return [...tasks.slice(0, s), ...tasks.slice(e, ne), ...tasks.slice(s, e), ...tasks.slice(ne)]
  }
  let p = s - 1
  while (p >= 0 && tasks[p].outlineLevel > level) p--
  if (p < 0 || tasks[p].outlineLevel !== level) return tasks
  return [...tasks.slice(0, p), ...tasks.slice(s, e), ...tasks.slice(p, s), ...tasks.slice(e)]
}

/** Ids of a task and all its descendants. */
export function subtreeIds(tasks: Task[], id: string): string[] {
  const i = tasks.findIndex((t) => t.id === id)
  if (i < 0) return []
  const [s, e] = subtreeRange(tasks, i)
  return tasks.slice(s, e).map((t) => t.id)
}

/** Tasks without children (summaries are roll-ups and would double-count in statistics). */
export function leafTasks(tasks: Task[]): Task[] {
  return tasks.filter((t, i) => !(tasks[i + 1] && tasks[i + 1].outlineLevel > t.outlineLevel))
}
