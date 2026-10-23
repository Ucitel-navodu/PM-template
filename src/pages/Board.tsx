import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useApp } from '../context/AppContext'
import { useSchedule } from '../lib/schedule/useSchedule'
import { computeHealth } from '../lib/health'
import { formatDate } from '../lib/format'
import { HEALTH_COLOR, HEALTH_COLOR_DARK, STATUS_ICON } from '../data/config'
import { statusKind } from '../lib/status'
import { selectFilter } from '../lib/ui'
import type { StatusDef, Task } from '../types'

function Card({ task, dragging = false }: { task: Task; dragging?: boolean }) {
  const { theme, settings } = useApp()
  const sched = useSchedule()
  const health = computeHealth(task, settings)
  const color = health ? (theme === 'dark' ? HEALTH_COLOR_DARK : HEALTH_COLOR)[health] : 'transparent'
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-2.5 text-sm shadow-sm dark:border-white/10 dark:bg-[#24242f] ${dragging ? 'rotate-1 shadow-lg ring-2 ring-brand-400' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-gray-800 dark:text-gray-100">
          <span className="mr-1 text-xs text-gray-400">#{task.no}</span>
          {task.milestone && '◆ '}
          {task.name || '—'}
        </span>
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} title={health} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {task.owner && <span>👤 {task.owner}</span>}
        {task.currentFinish && <span>📅 {formatDate(task.currentFinish)}</span>}
        {task.percentComplete != null && <span>{Math.round(task.percentComplete * 100)} %</span>}
        {sched.tasks.get(task.id)?.critical && <span className="rounded bg-rose-100 px-1 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">CP</span>}
      </div>
    </div>
  )
}

function DraggableCard({ task, disabled }: { task: Task; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={`${isDragging ? 'opacity-30' : ''} ${disabled ? '' : 'cursor-grab'} rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`} data-task-no={task.no}>
      <Card task={task} />
    </div>
  )
}

function Column({ status, tasks, disabled }: { status: StatusDef; tasks: Task[]; disabled: boolean }) {
  const { tr } = useApp()
  const { setNodeRef, isOver } = useDroppable({ id: status.name })
  return (
    <section
      ref={setNodeRef}
      data-status={status.name}
      aria-label={status.name}
      className={`flex min-h-[12rem] min-w-[12.5rem] flex-1 flex-col rounded-xl border p-2 transition-colors ${
        isOver ? 'border-brand-400 bg-brand-50 dark:bg-brand-500/10' : 'border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.03]'
      }`}
    >
      <h3 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
        <span>
          {STATUS_ICON[status.kind]} {status.name}
        </span>
        <span className="rounded-full bg-gray-200 px-2 text-xs dark:bg-white/10">{tasks.length}</span>
      </h3>
      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} disabled={disabled} />
        ))}
        {tasks.length === 0 && <p className="px-1 py-4 text-center text-xs text-gray-400">{tr('board_empty')}</p>}
      </div>
    </section>
  )
}

export function BoardPage() {
  const { tr, tasks, settings, readOnly, updateTask } = useApp()
  const sched = useSchedule()
  const [phase, setPhase] = useState('')
  const [owner, setOwner] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor))

  // Leaf tasks only: summary status is derived from its children.
  const cards = useMemo(
    () => tasks.filter((t) => !sched.outline.get(t.id)?.isSummary && (!phase || t.phase === phase) && (!owner || t.owner === owner)),
    [tasks, sched, phase, owner],
  )
  const owners = useMemo(() => [...new Set(tasks.map((t) => t.owner).filter(Boolean))].sort(), [tasks])

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const status = e.over?.id as string | undefined
    const task = cards.find((t) => t.id === e.active.id)
    if (!status || !task || task.status === status) return
    // Keep status and % consistent so the task does not turn Blue (data issue).
    const patch: Partial<Task> = { status }
    if (statusKind(status, settings.statuses) === 'Not started') patch.percentComplete = 0
    updateTask(task.id, patch)
  }

  const active = activeId ? cards.find((t) => t.id === activeId) : undefined

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={phase} onChange={(e) => setPhase(e.target.value)} className={selectFilter}>
          <option value="">
            {tr('tasks_filter_all')} — {tr('tasks_phase')}
          </option>
          {settings.phases.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={owner} onChange={(e) => setOwner(e.target.value)} className={selectFilter}>
          <option value="">{tr('plan_all_owners')}</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500 dark:text-gray-400">{tr('board_hint')}</span>
      </div>
      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {settings.statuses.map((s) => (
            <Column key={s.name} status={s} tasks={cards.filter((t) => t.status === s.name)} disabled={readOnly} />
          ))}
        </div>
        <DragOverlay>{active ? <Card task={active} dragging /> : null}</DragOverlay>
      </DndContext>
    </div>
  )
}
