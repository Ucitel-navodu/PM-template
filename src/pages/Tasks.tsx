import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Cell,
  type ColumnSizingState,
  type Row,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useApp } from '../context/AppContext'
import { useActiveProject, useWorkspaceStore } from '../store/workspaceStore'
import { computeHealth, expectedProgress } from '../lib/health'
import { HealthBadge } from '../components/HealthBadge'
import { BaselinesDialog } from '../components/BaselinesDialog'
import { formatDate, formatPercent } from '../lib/format'
import { downloadCsv } from '../lib/csv'
import { STATUS_ICON } from '../data/config'
import { statusKind } from '../lib/status'
import { btnPrimary, btnSecondary, inputGhost, selectFilter, selectGhost, tableWrap, tbodyRow, theadRow } from '../lib/ui'
import { useSchedule } from '../lib/schedule/useSchedule'
import { formatDependencies, parseDependencies } from '../lib/schedule/predecessors'
import { indent, move, moveSubtree, outdent, subtreeIds } from '../lib/schedule/tree'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { loadPref, savePref } from '../lib/storage'
import { WorkCalendar } from '../lib/schedule/calendar'
import { newId } from '../domain/workspace'
import type { Task, TaskView } from '../types'

const NEW_OPTION = '__new__'

// Options for a select bound to a user-defined list. Keeps a value that was
// since removed from Settings visible, so the row doesn't silently show
// another option than what's stored.
function listOptions(list: string[], current?: string): string[] {
  return current && !list.includes(current) ? [...list, current] : list
}

interface Filters {
  text: string
  phase: string
  area: string
  status: string
  owner: string
  critical: string // '1' = critical path only
}
const NO_FILTERS: Filters = { text: '', phase: '', area: '', status: '', owner: '', critical: '' }

const DEFAULT_HIDDEN = ['baselineStart', 'baselineFinish', 'variance', 'expected', 'priority', 'mgmtExport', 'notes', 'area', 'freeFloat']

/**
 * Text cell edited as a local draft and committed on blur / Enter (Esc reverts):
 * the usual grid behaviour. Typing never re-schedules or re-renders the table.
 */
function DraftInput({ value, onCommit, className, list, label }: { value: string; onCommit: (v: string) => void; className?: string; list?: string; label?: string }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <input
      value={draft}
      title={draft}
      aria-label={label}
      list={list}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setDraft(value)
          e.stopPropagation()
        }
      }}
      className={className}
    />
  )
}

const DEFAULT_SIZES: Record<string, number> = { actions: 84, no: 44, wbs: 60, name: 320, mode: 120, duration: 84, start: 132, finish: 132, predecessors: 130, percent: 96, status: 140, owner: 150, phase: 130, area: 130, priority: 110, milestone: 70, float: 84, freeFloat: 90, critical: 70, health: 90, baselineStart: 104, baselineFinish: 104, variance: 90, expected: 96, mgmtExport: 80, notes: 240 }

// The row tools stay visible while the table scrolls sideways on narrow screens.
const STICKY = 'sticky left-0 z-10 bg-white dark:bg-[rgb(var(--pm-card))]'

// Insertion line while dragging: where the task lands (above / below the row under the pointer).
const DROP_BEFORE = '[&>td]:shadow-[inset_0_3px_0_0_rgb(var(--pm-primary))]'
const DROP_AFTER = '[&>td]:shadow-[inset_0_-3px_0_0_rgb(var(--pm-primary))]'

interface MenuItem {
  id: string
  icon: string
  label: string
  hint?: string
  run: () => void
  disabled?: boolean
  danger?: boolean
  separated?: boolean
}

/**
 * Row tools as a menu (the \u22ef button or a right click). Rendered into <body>:
 * the table scrolls in its own box and would clip it. Closes on outside click,
 * Esc, scroll or after an action; arrow keys move between items.
 */
function RowMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  // Keep the whole menu inside the window (rows at the bottom / right edge).
  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect()
    setPos({ left: Math.max(4, Math.min(x, window.innerWidth - r.width - 4)), top: y + r.height > window.innerHeight - 4 ? Math.max(4, y - r.height - 4) : y })
    ref.current!.querySelector<HTMLElement>('[role=menuitem]:not(:disabled)')?.focus()
  }, [x, y])
  useEffect(() => {
    const away = (e: Event) => !ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest?.('[data-row-menu]') && onClose()
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', away)
    document.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    window.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('keydown', key)
    }
  }, [onClose])
  const step = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const els = [...ref.current!.querySelectorAll<HTMLElement>('[role=menuitem]:not(:disabled)')]
    const i = els.indexOf(document.activeElement as HTMLElement)
    els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus()
  }
  return createPortal(
    <div
      ref={ref}
      role="menu"
      data-testid="row-menu"
      onKeyDown={step}
      onContextMenu={(e) => e.preventDefault()}
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-50 min-w-[15rem] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-xl dark:border-white/10 dark:bg-[rgb(var(--pm-card))]"
    >
      {items.map((it) => (
        <button
          key={it.id}
          role="menuitem"
          data-menu-item={it.id}
          disabled={it.disabled}
          onClick={() => {
            onClose()
            it.run()
          }}
          className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left outline-none hover:bg-gray-100 focus:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/10 dark:focus:bg-white/10 ${it.separated ? 'mt-1 border-t border-gray-100 pt-2 dark:border-white/10' : ''} ${it.danger ? 'text-rose-600 dark:text-rose-400' : 'text-gray-700 dark:text-gray-200'}`}
        >
          <span aria-hidden className="w-4 text-center">
            {it.icon}
          </span>
          <span className="flex-1 whitespace-nowrap">{it.label}</span>
          {it.hint && <kbd className="ml-4 whitespace-nowrap font-sans text-[11px] text-gray-400">{it.hint}</kbd>}
        </button>
      ))}
    </div>,
    document.body,
  )
}

/** A table row that can be dragged by its handle and is a drop target for other rows. */
function TaskRow({ row, className, dnd, hint, select, onKeyDown, onMenu, renderCell }: { onMenu: (x: number, y: number) => void; row: Row<Task>; className: string; dnd: boolean; hint?: 'before' | 'after'; select?: { on: boolean; toggle: (shift: boolean) => void }; onKeyDown: (e: React.KeyboardEvent) => void; renderCell: (c: Cell<Task, unknown>) => React.ReactNode }) {
  const drag = useDraggable({ id: row.id, disabled: !dnd })
  const drop = useDroppable({ id: row.id, disabled: !dnd })
  return (
    <tr
      ref={drop.setNodeRef}
      data-task-no={row.original.no}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => {
        // Fields keep the browser's own menu (copy / paste / spelling).
        if ((e.target as HTMLElement).closest('input, select, textarea')) return
        e.preventDefault()
        onMenu(e.clientX, e.clientY)
      }}
      data-drop={hint}
      className={`${className} ${drag.isDragging ? 'opacity-40' : ''} ${hint === 'before' ? DROP_BEFORE : hint === 'after' ? DROP_AFTER : ''} ${select?.on ? 'bg-brand-50 dark:bg-white/10' : ''}`}
    >
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className={`overflow-hidden px-2 py-1 ${cell.column.id === 'actions' ? STICKY : ''}`}>
          {cell.column.id === 'actions' ? (
            <div className="flex items-center gap-0.5">
              {select && (
                <input type="checkbox" data-select checked={select.on} onChange={() => undefined} onClick={(e) => select.toggle(e.shiftKey)} aria-label="select" className="mx-1 h-4 w-4 accent-[rgb(var(--pm-primary))]" />
              )}
              {dnd && !select && (
                <button ref={drag.setNodeRef} {...drag.listeners} {...drag.attributes} data-drag-handle className="cursor-grab touch-none px-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label="drag">
                  ⠿
                </button>
              )}
              {renderCell(cell)}
            </div>
          ) : (
            renderCell(cell)
          )}
        </td>
      ))}
    </tr>
  )
}

/** Predecessor cell: edited as text, committed on blur/Enter, invalid tokens flagged. */
function PredecessorsInput({ task, tasks, onCommit }: { task: Task; tasks: Task[]; onCommit: (deps: Task['dependencies']) => void }) {
  const { tr } = useApp()
  const formatted = formatDependencies(task.dependencies, tasks)
  const [text, setText] = useState(formatted)
  const [errors, setErrors] = useState<string[]>([])
  useEffect(() => setText(formatted), [formatted])
  const commit = () => {
    const r = parseDependencies(text, tasks, task.id)
    setErrors(r.errors)
    if (formatDependencies(r.deps, tasks) !== formatted) onCommit(r.deps)
  }
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      placeholder={tr('plan_pred_placeholder')}
      title={errors.length ? `${tr('plan_pred_invalid')}: ${errors.join(', ')}` : tr('plan_pred_help')}
      aria-invalid={errors.length > 0}
      className={`w-28 ${inputGhost} ${errors.length ? 'border-rose-400 text-rose-600 dark:border-rose-400' : ''}`}
    />
  )
}

function ColumnsMenu({ columns, visibility, onToggle }: { columns: { id: string; label: string }[]; visibility: VisibilityState; onToggle: (id: string) => void }) {
  const { tr } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button className={btnSecondary} onClick={() => setOpen(!open)} aria-expanded={open}>
        {tr('plan_columns')} ▾
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 max-h-96 w-56 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[rgb(var(--pm-card))]">
          {columns.map((c) => (
            <label key={c.id} className="flex items-center gap-2 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5">
              <input type="checkbox" checked={visibility[c.id] !== false} onChange={() => onToggle(c.id)} />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export function TasksPage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { tr, settings, updateSettings, readOnly, addTask, updateTask, deleteTask } = useApp()
  const project = useActiveProject()
  const store = useWorkspaceStore.getState()
  const tasks = useMemo(() => project?.tasks ?? [], [project?.tasks])
  const sched = useSchedule()
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [sorting, setSorting] = useState<SortingState>([])
  const [visibility, setVisibility] = useState<VisibilityState>(() => Object.fromEntries(DEFAULT_HIDDEN.map((c) => [c, false])))
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  // Column widths: per device, also stored in saved views.
  const [sizing, setSizing] = useState<ColumnSizingState>(() => ({ ...DEFAULT_SIZES, ...loadPref<ColumnSizingState>('taskColumnSizes', {}), actions: DEFAULT_SIZES.actions }))
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  useEffect(() => savePref('taskColumnSizes', sizing), [sizing])
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropHint, setDropHint] = useState<{ id: string; pos: 'before' | 'after' } | null>(null)
  // Selection mode (bulk delete): off by default so the grid stays calm.
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastPicked, setLastPicked] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const [viewId, setViewId] = useState('')
  const [baselinesOpen, setBaselinesOpen] = useState(false)
  const cal = useMemo(() => new WorkCalendar(settings, '2000-01-01'), [settings])

  const owners = useMemo(() => [...new Set(tasks.map((t) => t.owner).filter(Boolean))].sort(), [tasks])
  const isSummary = (id: string) => sched.outline.get(id)?.isSummary ?? false

  // Filtering keeps the outline readable: matching tasks are shown with their ancestors.
  const rows = useMemo(() => {
    const f = filters
    const text = f.text.trim().toLowerCase()
    const active = Object.values(f).some(Boolean)
    const matches = (t: Task) =>
      (!text || `${t.no} ${t.name} ${t.owner} ${t.notes ?? ''}`.toLowerCase().includes(text)) &&
      (!f.phase || t.phase === f.phase) &&
      (!f.area || t.projectArea === f.area) &&
      (!f.status || t.status === f.status) &&
      (!f.owner || t.owner === f.owner) &&
      (!f.critical || Boolean(sched.tasks.get(t.id)?.critical))
    const visible = new Set<string>()
    for (const t of tasks) {
      if (active && !matches(t)) continue
      visible.add(t.id)
      let parent = sched.outline.get(t.id)?.parentId
      while (parent) {
        visible.add(parent)
        parent = sched.outline.get(parent)?.parentId
      }
    }
    const hidden = new Set<string>()
    for (const id of collapsed) for (const sub of subtreeIds(tasks, id).slice(1)) hidden.add(sub)
    return tasks.filter((t) => visible.has(t.id) && !hidden.has(t.id))
  }, [tasks, filters, collapsed, sched])

  const askNewItem = (list: 'phases' | 'projectAreas', label: string): string | null => {
    const name = window.prompt(label)?.trim()
    if (!name) return null
    if (!settings[list].includes(name)) updateSettings({ [list]: [...settings[list], name] })
    return name
  }

  const removeTask = (t: Task) => {
    const count = subtreeIds(tasks, t.id).length - 1
    if (count > 0 && !window.confirm(tr('plan_delete_summary_confirm').replace('{name}', t.name).replace('{count}', String(count)))) return
    deleteTask(t.id)
  }

  const onRowKey = (e: React.KeyboardEvent, id: string) => {
    if (!e.altKey || !e.shiftKey || readOnly) return
    if (e.key === 'ArrowRight') store.setTasks((ts) => indent(ts, id))
    else if (e.key === 'ArrowLeft') store.setTasks((ts) => outdent(ts, id))
    else if (e.key === 'ArrowUp') store.setTasks((ts) => move(ts, id, -1))
    else if (e.key === 'ArrowDown') store.setTasks((ts) => move(ts, id, 1))
    else return
    e.preventDefault()
  }

  const menuTask = menu ? tasks.find((t) => t.id === menu.id) : undefined
  const menuItems = (t: Task): MenuItem[] => {
    // "Odsadit (Alt+Shift+→)" -> label + shortcut
    const split = (text: string) => /^(.*?)\s*\((.+)\)$/.exec(text)?.slice(1) ?? [text, '']
    const item = (id: string, icon: string, text: string, run: () => void, extra: Partial<MenuItem> = {}): MenuItem => ({ id, icon, label: split(text)[0], hint: split(text)[1], run, disabled: readOnly, ...extra })
    return [
      item('add-below', '＋', tr('plan_insert_below'), () => addTask({ phase: t.phase, projectArea: t.projectArea }, t.id)),
      item('add-subtask', '↳', tr('plan_add_subtask'), () => addTask({ phase: t.phase, projectArea: t.projectArea, outlineLevel: t.outlineLevel + 1 }, t.id)),
      item('indent', '⇥', tr('plan_indent'), () => store.setTasks((ts) => indent(ts, t.id)), { separated: true }),
      item('outdent', '⇤', tr('plan_outdent'), () => store.setTasks((ts) => outdent(ts, t.id)), { disabled: readOnly || t.outlineLevel <= 1 }),
      item('up', '↑', `${tr('plan_move_up')} (Alt+Shift+↑)`, () => store.setTasks((ts) => move(ts, t.id, -1))),
      item('down', '↓', `${tr('plan_move_down')} (Alt+Shift+↓)`, () => store.setTasks((ts) => move(ts, t.id, 1))),
      item('delete', '🗑', tr('tasks_delete'), () => removeTask(t), { separated: true, danger: true }),
    ]
  }

  const col = createColumnHelper<Task>()
  const columns = useMemo(
    () => [
      col.display({
        id: 'actions',
        header: '',
        enableHiding: false,
        cell: ({ row: { original: t } }) => {
          const b = 'rounded px-1.5 py-0.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-gray-100'
          return (
            <div className="flex gap-0.5 whitespace-nowrap">
              <button className={`${b} font-bold text-brand-600 dark:text-brand-300`} title={tr('plan_insert_below')} aria-label={tr('plan_insert_below')} data-add-below disabled={readOnly} onClick={() => addTask({ phase: t.phase, projectArea: t.projectArea }, t.id)}>
                ＋
              </button>
              <button
                className={b}
                title={tr('plan_row_menu')}
                aria-label={tr('plan_row_menu')}
                aria-haspopup="menu"
                data-row-menu
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  setMenu((m) => (m?.id === t.id ? null : { id: t.id, x: r.left, y: r.bottom + 2 }))
                }}
              >
                ⋯
              </button>
            </div>
          )
        },
      }),
      col.accessor('no', { id: 'no', header: '#', cell: (c) => <span className="text-xs text-gray-400">{c.getValue()}</span> }),
      col.accessor('wbs', { id: 'wbs', header: 'WBS', cell: (c) => <span className="text-xs text-gray-500 dark:text-gray-400">{c.getValue()}</span> }),
      col.accessor('name', {
        id: 'name',
        header: tr('tasks_task_name'),
        cell: ({ row: { original: t } }) => {
          const summary = isSummary(t.id)
          const depth = (t.outlineLevel - 1) * 16
          return (
            <div className="flex items-center gap-1" style={{ paddingLeft: depth }}>
              {summary ? (
                <button
                  className="w-4 text-xs text-gray-500"
                  onClick={() =>
                    setCollapsed((c) => {
                      const next = new Set(c)
                      if (next.has(t.id)) next.delete(t.id)
                      else next.add(t.id)
                      return next
                    })
                  }
                  aria-label={collapsed.has(t.id) ? '+' : '−'}
                >
                  {collapsed.has(t.id) ? '▸' : '▾'}
                </button>
              ) : (
                <span className="w-4 text-center text-xs text-gray-400">{t.milestone ? '◆' : ''}</span>
              )}
              <DraftInput value={t.name} onCommit={(v) => updateTask(t.id, { name: v })} label={tr('tasks_task_name')} className={`min-w-0 flex-1 ${inputGhost} ${summary ? 'font-semibold' : ''}`} />
              {t.constraint && t.schedulingMode === 'auto' && !summary && (
                <button
                  className="text-xs"
                  title={tr('plan_constraint').replace('{date}', formatDate(t.constraint.date))}
                  onClick={() => updateTask(t.id, { constraint: undefined })}
                  disabled={readOnly}
                >
                  📌
                </button>
              )}
            </div>
          )
        },
      }),
      col.accessor('schedulingMode', {
        id: 'mode',
        header: tr('plan_mode'),
        cell: ({ row: { original: t } }) =>
          isSummary(t.id) ? null : (
            <select
              value={t.schedulingMode}
              onChange={(e) => updateTask(t.id, { schedulingMode: e.target.value as Task['schedulingMode'] })}
              className={selectGhost}
              title={t.schedulingMode === 'auto' ? tr('plan_auto_help') : tr('plan_manual_help')}
            >
              <option value="auto">⚙ {tr('plan_auto')}</option>
              <option value="manual">✋ {tr('plan_manual')}</option>
            </select>
          ),
      }),
      col.accessor((t) => t.duration ?? 0, {
        id: 'duration',
        header: tr('plan_duration_days'),
        cell: ({ row: { original: t } }) =>
          isSummary(t.id) || t.schedulingMode === 'manual' ? (
            <span className="px-1 text-gray-500 dark:text-gray-400">{t.duration ?? ''}</span>
          ) : (
            <input
              type="number"
              min={0}
              value={t.duration ?? ''}
              onChange={(e) => e.target.value !== '' && updateTask(t.id, { duration: Math.max(0, Math.round(Number(e.target.value))) })}
              className={`w-14 ${inputGhost}`}
            />
          ),
      }),
      col.accessor((t) => t.currentStart ?? '', {
        id: 'start',
        header: tr('tasks_current_start'),
        cell: ({ row: { original: t } }) =>
          isSummary(t.id) ? (
            <span className="px-1 text-xs font-medium">{formatDate(t.currentStart)}</span>
          ) : (
            <input
              type="date"
              value={t.currentStart ?? ''}
              onChange={(e) => e.target.value && updateTask(t.id, { currentStart: e.target.value })}
              className={selectGhost}
            />
          ),
      }),
      col.accessor((t) => t.currentFinish ?? '', {
        id: 'finish',
        header: tr('tasks_current_finish'),
        cell: ({ row: { original: t } }) =>
          isSummary(t.id) ? (
            <span className="px-1 text-xs font-medium">{formatDate(t.currentFinish)}</span>
          ) : (
            <input
              type="date"
              value={t.currentFinish ?? ''}
              min={t.currentStart}
              onChange={(e) => e.target.value && updateTask(t.id, { currentFinish: e.target.value })}
              className={selectGhost}
            />
          ),
      }),
      col.display({
        id: 'predecessors',
        header: tr('tasks_predecessors'),
        cell: ({ row: { original: t } }) => (
          <PredecessorsInput task={t} tasks={tasks} onCommit={(deps) => updateTask(t.id, { dependencies: deps })} />
        ),
      }),
      col.accessor((t) => t.percentComplete ?? -1, {
        id: 'percent',
        header: tr('tasks_percent_complete'),
        cell: ({ row: { original: t } }) =>
          isSummary(t.id) ? (
            <span className="px-1 text-xs font-medium">{formatPercent(t.percentComplete)}</span>
          ) : (
            <span className="whitespace-nowrap">
              <input
                type="number"
                min={0}
                max={100}
                value={t.percentComplete == null ? '' : Math.round(t.percentComplete * 100)}
                onChange={(e) =>
                  updateTask(t.id, { percentComplete: e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value))) / 100 })
                }
                className={`w-14 ${inputGhost}`}
              />
              <span className="text-xs text-gray-400">%</span>
            </span>
          ),
      }),
      col.accessor('status', {
        id: 'status',
        header: tr('common_status'),
        cell: ({ row: { original: t } }) =>
          isSummary(t.id) ? null : (
            <select value={t.status} onChange={(e) => updateTask(t.id, { status: e.target.value as Task['status'] })} className={selectGhost}>
              {listOptions(settings.statuses.map((s) => s.name), t.status).map((s) => (
                <option key={s} value={s}>
                  {STATUS_ICON[statusKind(s, settings.statuses)]} {s}
                </option>
              ))}
            </select>
          ),
      }),
      col.accessor('owner', {
        id: 'owner',
        header: tr('common_owner'),
        cell: ({ row: { original: t } }) => (
          <DraftInput value={t.owner} onCommit={(v) => updateTask(t.id, { owner: v })} className={`w-full ${inputGhost}`} list="task-owners" label={tr('common_owner')} />
        ),
      }),
      col.accessor('phase', {
        id: 'phase',
        header: tr('tasks_phase'),
        cell: ({ row: { original: t } }) => (
          <select
            value={t.phase}
            onChange={(e) => {
              const v = e.target.value === NEW_OPTION ? askNewItem('phases', tr('tasks_new_phase_prompt')) : e.target.value
              if (v !== null) updateTask(t.id, { phase: v })
            }}
            className={selectGhost}
          >
            <option value="">—</option>
            {listOptions(settings.phases, t.phase).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value={NEW_OPTION}>{tr('tasks_new_phase')}</option>
          </select>
        ),
      }),
      col.accessor((t) => t.projectArea ?? '', {
        id: 'area',
        header: tr('common_project_area'),
        cell: ({ row: { original: t } }) => (
          <select
            value={t.projectArea ?? ''}
            onChange={(e) => {
              const v = e.target.value === NEW_OPTION ? askNewItem('projectAreas', tr('settings_new_item')) : e.target.value
              if (v !== null) updateTask(t.id, { projectArea: v || undefined })
            }}
            className={selectGhost}
          >
            <option value="">—</option>
            {listOptions(settings.projectAreas, t.projectArea).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            <option value={NEW_OPTION}>{tr('tasks_new_area')}</option>
          </select>
        ),
      }),
      col.accessor('priority', {
        id: 'priority',
        header: tr('plan_priority'),
        cell: ({ row: { original: t } }) => (
          <select value={t.priority} onChange={(e) => updateTask(t.id, { priority: e.target.value as Task['priority'] })} className={selectGhost}>
            {listOptions(settings.priorities, t.priority).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        ),
      }),
      col.accessor('milestone', {
        id: 'milestone',
        header: tr('gantt_milestone'),
        cell: ({ row: { original: t } }) =>
          isSummary(t.id) ? null : (
            <input type="checkbox" checked={t.milestone} onChange={(e) => updateTask(t.id, { milestone: e.target.checked })} />
          ),
      }),
      col.accessor((t) => sched.tasks.get(t.id)?.totalFloat ?? 0, {
        id: 'float',
        header: tr('plan_float'),
        cell: (c) => <span className="text-xs text-gray-500 dark:text-gray-400">{c.getValue()}</span>,
      }),
      col.accessor((t) => sched.tasks.get(t.id)?.freeFloat ?? 0, {
        id: 'freeFloat',
        header: tr('plan_free_float'),
        cell: (c) => <span className="text-xs text-gray-500 dark:text-gray-400">{c.getValue()}</span>,
      }),
      col.accessor((t) => (sched.tasks.get(t.id)?.critical ? 1 : 0), {
        id: 'critical',
        header: tr('plan_critical'),
        cell: (c) => (c.getValue() ? <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">●</span> : null),
      }),
      col.accessor((t) => computeHealth(t, settings), {
        id: 'health',
        header: tr('common_health'),
        cell: (c) => <HealthBadge health={c.getValue()} />,
      }),
      col.accessor((t) => t.baselineStart ?? '', {
        id: 'baselineStart',
        header: tr('tasks_baseline_start'),
        cell: (c) => <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(c.getValue())}</span>,
      }),
      col.accessor((t) => t.baselineFinish ?? '', {
        id: 'baselineFinish',
        header: tr('tasks_baseline_finish'),
        cell: (c) => <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(c.getValue())}</span>,
      }),
      col.accessor(
        (t) => {
          if (!t.baselineFinish || !t.currentFinish) return null
          if (t.currentFinish === t.baselineFinish) return 0
          return t.currentFinish > t.baselineFinish
            ? cal.workdaysBetween(t.baselineFinish, t.currentFinish) - (cal.isWorkingDay(t.baselineFinish) ? 1 : 0)
            : -(cal.workdaysBetween(t.currentFinish, t.baselineFinish) - (cal.isWorkingDay(t.currentFinish) ? 1 : 0))
        },
        {
          id: 'variance',
          header: tr('plan_variance'),
          sortUndefined: 'last',
          cell: (c) => {
            const v = c.getValue()
            if (v === null) return null
            return <span className={`text-xs font-medium ${v > 0 ? 'text-rose-600' : v < 0 ? 'text-emerald-600' : 'text-gray-400'}`}>{v > 0 ? `+${v}` : v}</span>
          },
        },
      ),
      col.accessor((t) => expectedProgress(t.currentStart, t.currentFinish) ?? -1, {
        id: 'expected',
        header: tr('tasks_expected_progress'),
        cell: ({ row: { original: t } }) => <span className="text-xs text-gray-500">{formatPercent(expectedProgress(t.currentStart, t.currentFinish))}</span>,
      }),
      col.accessor('mgmtExport', {
        id: 'mgmtExport',
        header: tr('common_mgmt_export'),
        cell: ({ row: { original: t } }) => (
          <input type="checkbox" checked={t.mgmtExport} onChange={(e) => updateTask(t.id, { mgmtExport: e.target.checked })} />
        ),
      }),
      col.accessor((t) => t.notes ?? '', {
        id: 'notes',
        header: tr('common_notes'),
        cell: ({ row: { original: t } }) => (
          <DraftInput value={t.notes ?? ''} onCommit={(v) => updateTask(t.id, { notes: v || undefined })} className={`w-full ${inputGhost}`} label={tr('common_notes')} />
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, sched, settings, collapsed, readOnly, tr, cal],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility: visibility, columnSizing: sizing },
    onSortingChange: setSorting,
    onColumnSizingChange: setSizing,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 40, maxSize: 900 },
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (t) => t.id,
  })

  // Cells are called as plain functions, not mounted as components: the column
  // definitions are rebuilt when data changes, and a new component identity would
  // remount every cell (an input would lose focus after each keystroke).
  const renderCell = (cell: Cell<Task, unknown>) => {
    const def = cell.column.columnDef.cell
    return typeof def === 'function' ? def(cell.getContext()) : def
  }
  // Reordering by drag & drop only makes sense in the natural outline order.
  const pick = (id: string, shift: boolean) => {
    const ids = table.getRowModel().rows.map((r) => r.id)
    setSelected((cur) => {
      const next = new Set(cur)
      const [a, b] = [ids.indexOf(lastPicked ?? id), ids.indexOf(id)].sort((x, y) => x - y)
      // Shift+click selects the whole range from the previously clicked row.
      if (shift && lastPicked && a >= 0) ids.slice(a, b + 1).forEach((x) => next.add(x))
      else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setLastPicked(id)
  }
  const removeSelected = () => {
    const all = new Set([...selected].flatMap((id) => subtreeIds(tasks, id)))
    if (!window.confirm(tr('tasks_delete_selected_confirm').replace('{n}', String(all.size)))) return
    store.deleteTasks([...selected])
    setSelected(new Set())
    setSelecting(false)
  }
  const canDrag = !readOnly && sorting.length === 0 && !Object.values(filters).some(Boolean)

  // --- saved views ----------------------------------------------------------
  const views = project?.views ?? []
  const applyView = (id: string) => {
    setViewId(id)
    const v = views.find((x) => x.id === id)
    setFilters(v ? { ...NO_FILTERS, ...v.filters } : NO_FILTERS)
    setSorting(v?.sort ? [v.sort] : [])
    const hidden = v ? v.hiddenColumns : DEFAULT_HIDDEN
    setVisibility(Object.fromEntries(hidden.map((c) => [c, false])))
    if (v?.columnSizes) setSizing({ ...DEFAULT_SIZES, ...v.columnSizes, actions: DEFAULT_SIZES.actions })
  }
  const saveView = () => {
    const name = window.prompt(tr('plan_view_name'), views.find((v) => v.id === viewId)?.name ?? '')?.trim()
    if (!name) return
    const existing = views.find((v) => v.name === name)
    const view: TaskView = {
      id: existing?.id ?? newId('v'),
      name,
      filters: { ...filters },
      hiddenColumns: Object.entries(visibility).filter(([, on]) => on === false).map(([c]) => c),
      sort: sorting[0],
      columnSizes: sizing,
    }
    store.saveView(view)
    setViewId(view.id)
  }

  const exportCsv = () => {
    downloadCsv(
      'tasks.csv',
      rows.map((t) => ({
        No: t.no,
        WBS: t.wbs,
        Name: t.name,
        Mode: t.schedulingMode,
        DurationWorkdays: t.duration ?? '',
        Start: t.currentStart ?? '',
        Finish: t.currentFinish ?? '',
        Predecessors: formatDependencies(t.dependencies, tasks),
        PercentComplete: t.percentComplete ?? '',
        Status: t.status,
        Owner: t.owner,
        Phase: t.phase,
        ProjectArea: t.projectArea ?? '',
        Priority: t.priority,
        Milestone: t.milestone ? 'YES' : 'NO',
        Summary: isSummary(t.id) ? 'YES' : 'NO',
        TotalSlack: sched.tasks.get(t.id)?.totalFloat ?? '',
        Critical: sched.tasks.get(t.id)?.critical ? 'YES' : 'NO',
        BaselineStart: t.baselineStart ?? '',
        BaselineFinish: t.baselineFinish ?? '',
        ExpectedProgress: expectedProgress(t.currentStart, t.currentFinish) ?? '',
        MgmtExport: t.mgmtExport ? 'YES' : 'NO',
        Health: computeHealth(t, settings),
        Notes: t.notes ?? '',
      })),
    )
  }

  const setFilter = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }))
  const allAuto = () => {
    if (window.confirm(tr('plan_all_auto_confirm'))) store.setTasks((ts) => ts.map((t) => ({ ...t, schedulingMode: 'auto' })))
  }
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide())

  return (
    <div className="space-y-3">
      <datalist id="task-owners">
        {owners.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input value={filters.text} onChange={(e) => setFilter('text', e.target.value)} placeholder={tr('plan_search')} className={`${selectFilter} w-40`} />
          <select value={filters.phase} onChange={(e) => setFilter('phase', e.target.value)} className={selectFilter}>
            <option value="">
              {tr('tasks_filter_all')} — {tr('tasks_phase')}
            </option>
            {settings.phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select value={filters.area} onChange={(e) => setFilter('area', e.target.value)} className={selectFilter}>
            <option value="">{tr('tasks_all_areas')}</option>
            {settings.projectAreas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className={selectFilter}>
            <option value="">
              {tr('tasks_filter_all')} — {tr('common_status')}
            </option>
            {settings.statuses.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={filters.owner} onChange={(e) => setFilter('owner', e.target.value)} className={selectFilter}>
            <option value="">{tr('plan_all_owners')}</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={filters.critical === '1'} onChange={(e) => setFilter('critical', e.target.checked ? '1' : '')} />
            {tr('plan_only_critical')}
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={viewId} onChange={(e) => applyView(e.target.value)} className={selectFilter} aria-label={tr('plan_views')}>
            <option value="">{tr('plan_view_default')}</option>
            {views.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <button className={btnSecondary} onClick={saveView} disabled={readOnly}>
            {tr('plan_view_save')}
          </button>
          {viewId && (
            <button
              className={btnSecondary}
              title={tr('plan_view_delete')}
              disabled={readOnly}
              onClick={() => {
                store.deleteView(viewId)
                applyView('')
              }}
            >
              ✕
            </button>
          )}
          <ColumnsMenu
            columns={hideable.map((c) => ({ id: c.id, label: String(c.columnDef.header) }))}
            visibility={visibility}
            onToggle={(id) => setVisibility((v) => ({ ...v, [id]: v[id] === false }))}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {tr('plan_finish')}: <span className="font-semibold text-gray-800 dark:text-gray-100">{formatDate(sched.finish) || '—'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onOpenSettings} className={btnSecondary}>
            ⚙️ {tr('settings_phases')}
          </button>
          <button onClick={allAuto} className={btnSecondary} disabled={readOnly}>
            ⚙ {tr('plan_all_auto')}
          </button>
          <button onClick={() => setBaselinesOpen(true)} className={btnSecondary}>
            📏 {tr('plan_baselines')}
          </button>
          <button onClick={exportCsv} className={btnSecondary}>
            {tr('tasks_export_csv')}
          </button>
          <button
            onClick={() => {
              setSelecting((v) => !v)
              setSelected(new Set())
            }}
            className={`${btnSecondary} ${selecting ? 'ring-2 ring-brand-500' : ''}`}
            aria-pressed={selecting}
            disabled={readOnly}
            data-testid="select-mode"
          >
            ☑ {tr('tasks_select')}
          </button>
          <button onClick={() => addTask({ phase: filters.phase || settings.phases[0] || '' })} className={btnPrimary} disabled={readOnly}>
            {tr('tasks_add')}
          </button>
        </div>
      </div>

      {selecting && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-brand-500/40 bg-brand-50 px-3 py-2 text-sm text-gray-800 dark:bg-white/5 dark:text-gray-100" data-testid="select-bar">
          <b>{tr('tasks_selected').replace('{n}', String(selected.size))}</b>
          <span className="text-xs text-gray-500 dark:text-gray-400">{tr('tasks_select_hint')}</span>
          <span className="ml-auto flex flex-wrap gap-2">
            <button className={btnSecondary} onClick={() => setSelected(new Set(table.getRowModel().rows.map((r) => r.id)))}>
              {tr('tasks_select_all')}
            </button>
            <button className={btnSecondary} onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
              {tr('tasks_select_none')}
            </button>
            <button className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-40" onClick={removeSelected} disabled={selected.size === 0} data-testid="delete-selected">
              🗑 {tr('tasks_delete_selected')}
            </button>
          </span>
        </div>
      )}

      {sched.cycle.length > 0 && (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {tr('plan_cycle').replace('{tasks}', sched.cycle.map((id) => `#${tasks.find((t) => t.id === id)?.no}`).join(', '))}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={(e) => setDragId(String(e.active.id))}
        onDragMove={(e) => {
          // Upper half of the row under the pointer = insert above it, lower half = below it.
          const start = e.activatorEvent as PointerEvent
          const y = start.clientY + e.delta.y
          const hint = e.over && e.over.id !== e.active.id ? { id: String(e.over.id), pos: y < e.over.rect.top + e.over.rect.height / 2 ? ('before' as const) : ('after' as const) } : null
          setDropHint((h) => (h?.id === hint?.id && h?.pos === hint?.pos ? h : hint))
        }}
        onDragCancel={() => {
          setDragId(null)
          setDropHint(null)
        }}
        onDragEnd={(e) => {
          const hint = dropHint
          setDragId(null)
          setDropHint(null)
          if (hint && hint.id !== e.active.id) store.setTasks((ts) => moveSubtree(ts, String(e.active.id), hint.id, hint.pos))
        }}
      >
        {/* Own scroll area: the header row and the horizontal scrollbar are always within reach. */}
        <div className={`${tableWrap} max-h-[calc(100vh-11rem)] min-h-[16rem] overflow-y-auto`} data-testid="tasks-scroll">
          <table className="text-sm" style={{ width: table.getTotalSize(), tableLayout: 'fixed' }}>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className={theadRow}>
                  {hg.headers.map((h) => (
                    <th key={h.id} className={`sticky top-0 overflow-hidden whitespace-nowrap bg-gray-50 px-2 py-2 dark:bg-[rgb(var(--pm-card))] ${h.id === 'actions' ? 'left-0 z-30' : 'z-20'}`} style={{ width: h.getSize() }} data-col={h.id}>
                      {h.column.getCanSort() ? (
                        <button className="max-w-full truncate uppercase" onClick={h.column.getToggleSortingHandler()} title={h.id === 'variance' ? tr('plan_variance_help') : String(h.column.columnDef.header)}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? ''}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        data-resizer
                        title={tr('plan_resize_hint')}
                        onMouseDown={h.getResizeHandler()}
                        onTouchStart={h.getResizeHandler()}
                        onDoubleClick={() => h.column.resetSize()}
                        className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-brand-500 ${h.column.getIsResizing() ? 'bg-brand-500' : 'bg-transparent'}`}
                      />
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const summary = isSummary(row.id)
                const critical = sched.tasks.get(row.id)?.critical
                return (
                  <TaskRow
                    key={row.id}
                    row={row}
                    dnd={canDrag}
                    hint={dropHint?.id === row.id ? dropHint.pos : undefined}
                    select={selecting ? { on: selected.has(row.id), toggle: (shift) => pick(row.id, shift) } : undefined}
                    onKeyDown={(e) => onRowKey(e, row.id)}
                    onMenu={(x, y) => setMenu({ id: row.id, x, y })}
                    renderCell={renderCell}
                    className={`${tbodyRow} ${summary ? 'bg-gray-50/70 dark:bg-white/[0.03]' : ''} ${critical ? 'shadow-[inset_3px_0_0_#d81e04]' : ''}`}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
        <DragOverlay>
          {dragId ? <div className="w-max max-w-md truncate whitespace-nowrap rounded-md border border-brand-500 bg-white px-3 py-1.5 text-sm shadow-lg dark:bg-[rgb(var(--pm-card))] dark:text-gray-100">{tasks.find((t) => t.id === dragId)?.name || '—'}</div> : null}
        </DragOverlay>
      </DndContext>
      {menu && menuTask && <RowMenu x={menu.x} y={menu.y} items={menuItems(menuTask)} onClose={() => setMenu(null)} />}
      {baselinesOpen && <BaselinesDialog onClose={() => setBaselinesOpen(false)} />}
    </div>
  )
}

