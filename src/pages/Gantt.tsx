import { useEffect, useMemo, useRef, useState } from 'react'
import Gantt, { type FrappeTask } from 'frappe-gantt'
import '../styles/frappe-gantt.css'
import { useApp } from '../context/AppContext'
import { useActiveProject } from '../store/workspaceStore'
import { useSchedule } from '../lib/schedule/useSchedule'
import { computeHealth } from '../lib/health'
import { formatDate, formatPercent } from '../lib/format'
import { toDateKey } from '../lib/dates'
import { HEALTH_COLOR, HEALTH_COLOR_DARK } from '../data/config'
import { formatDependencies } from '../lib/schedule/predecessors'
import type { Task } from '../types'

type ViewMode = 'Day' | 'Week' | 'Month' | 'Year'
const VIEW_LABEL: Record<ViewMode, 'gantt_view_day' | 'gantt_view_week' | 'gantt_view_month' | 'gantt_view_year'> = {
  Day: 'gantt_view_day',
  Week: 'gantt_view_week',
  Month: 'gantt_view_month',
  Year: 'gantt_view_year',
}

// frappe-gantt renders names and popups with innerHTML: escape everything we pass in,
// task names may come from imported files.
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export function GanttPage() {
  const { tr, lang, theme, settings, readOnly, updateTask } = useApp()
  const project = useActiveProject()
  const sched = useSchedule()
  const host = useRef<HTMLDivElement>(null)
  const gantt = useRef<Gantt | null>(null)
  const [mode, setMode] = useState<ViewMode>('Month')
  const [showCritical, setShowCritical] = useState(true)
  const tasks = useMemo(() => project?.tasks ?? [], [project?.tasks])
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  // Latest callbacks for the long-lived chart instance.
  const handlers = useRef({ updateTask, byId, sched })
  handlers.current = { updateTask, byId, sched }

  const bars: FrappeTask[] = useMemo(() => {
    const palette = theme === 'dark' ? HEALTH_COLOR_DARK : HEALTH_COLOR
    const dated = new Set(tasks.filter((t) => t.currentStart && t.currentFinish).map((t) => t.id))
    return tasks
      .filter((t) => dated.has(t.id))
      .map((t) => {
        const s = sched.tasks.get(t.id)
        const summary = sched.outline.get(t.id)?.isSummary
        const health = computeHealth(t, settings) || 'Grey'
        const classes = ['gx', summary && 'gx-sum', t.milestone && 'gx-ms', s?.critical && 'gx-crit'].filter(Boolean).join('-')
        return {
          id: t.id,
          name: esc(`${t.milestone ? '◆ ' : ''}${t.name || '—'}`),
          start: t.currentStart!,
          end: t.currentFinish! < t.currentStart! ? t.currentStart! : t.currentFinish!,
          progress: Math.round((t.percentComplete ?? 0) * 100),
          dependencies: t.dependencies.map((d) => d.predId).filter((id) => dated.has(id)),
          custom_class: classes,
          color: summary ? undefined : palette[health] + '55',
          color_progress: summary ? undefined : palette[health],
        }
      })
  }, [tasks, sched, settings, theme])

  const holidays = useMemo(
    () => ({
      'var(--gx-weekend)': 'weekend',
      'var(--gx-holiday)': settings.holidays.map((h) => ({ date: h.date, name: h.name })),
    }),
    [settings.holidays],
  )

  // Create the chart once; later changes go through refresh/update_options.
  useEffect(() => {
    if (!host.current || bars.length === 0 || gantt.current) return
    gantt.current = new Gantt(host.current, bars, {
      view_mode: mode,
      language: lang === 'CZ' ? 'cs' : 'en',
      readonly: readOnly,
      infinite_padding: false,
      today_button: false,
      scroll_to: 'today',
      holidays,
      is_weekend: (d: Date) => !settings.workingDays.includes(d.getDay()),
      bar_height: 22,
      padding: 14,
      popup: (ctx: { task: FrappeTask; set_title: (h: string) => void; set_subtitle: (h: string) => void; set_details: (h: string) => void }) => {
        const t = handlers.current.byId.get(ctx.task.id) as Task
        const s = handlers.current.sched.tasks.get(t.id)
        ctx.set_title(`#${t.no} ${esc(t.name)}`)
        ctx.set_subtitle(esc([t.owner, t.phase].filter(Boolean).join(' · ')))
        const preds = formatDependencies(t.dependencies, [...handlers.current.byId.values()])
        ctx.set_details(
          [
            `${formatDate(t.currentStart)} – ${formatDate(t.currentFinish)} (${s?.duration ?? t.duration ?? 0} pd)`,
            `${esc(tr('tasks_percent_complete'))}: ${formatPercent(t.percentComplete)}`,
            preds && `${esc(tr('tasks_predecessors'))}: ${esc(preds)}`,
            t.baselineFinish && `Baseline: ${formatDate(t.baselineFinish)}`,
            s && `${esc(tr('plan_float'))}: ${s.totalFloat}${s.critical ? ` · ${esc(tr('plan_critical'))}` : ''}`,
          ]
            .filter(Boolean)
            .join('<br/>'),
        )
      },
      on_date_change: (task: FrappeTask, start: Date, end: Date) => {
        const t = handlers.current.byId.get(task.id)
        if (!t || handlers.current.sched.outline.get(t.id)?.isSummary) {
          gantt.current?.refresh(barsRef.current)
          return
        }
        handlers.current.updateTask(t.id, { currentStart: toDateKey(start), currentFinish: toDateKey(end) })
      },
      on_progress_change: (task: FrappeTask, progress: number) => {
        const t = handlers.current.byId.get(task.id)
        if (t && !handlers.current.sched.outline.get(t.id)?.isSummary) {
          handlers.current.updateTask(t.id, { percentComplete: Math.round(progress) / 100 })
        }
      },
    })
    // Open on today, once the container has its size.
    requestAnimationFrame(() => scrollToToday())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars.length > 0])

  // Today at one third of the width: the near future matters more than the past.
  const scrollToToday = () => {
    const box = host.current?.querySelector<HTMLElement>('.gantt-container')
    const today = host.current?.querySelector<HTMLElement>('.current-highlight')
    if (box && today) box.scrollLeft = Math.max(0, today.offsetLeft - box.clientWidth / 3)
  }

  const barsRef = useRef(bars)
  const renderedBars = useRef(bars)
  barsRef.current = bars

  // Data changed: redraw, keeping the scroll position.
  useEffect(() => {
    const g = gantt.current
    if (!g || renderedBars.current === bars) return
    renderedBars.current = bars
    const box = host.current?.querySelector('.gantt-container')
    const left = box?.scrollLeft ?? 0
    const top = box?.scrollTop ?? 0
    g.refresh(bars)
    const after = host.current?.querySelector('.gantt-container')
    if (after) {
      after.scrollLeft = left
      after.scrollTop = top
    }
  }, [bars])

  useEffect(() => {
    gantt.current?.update_options({ readonly: readOnly, language: lang === 'CZ' ? 'cs' : 'en', holidays })
  }, [readOnly, lang, holidays])

  const firstMode = useRef(true)
  useEffect(() => {
    if (firstMode.current) {
      firstMode.current = false
      return
    }
    gantt.current?.change_view_mode(mode)
    scrollToToday()
  }, [mode])

  useEffect(() => () => gantt.current?.clear(), [])

  const btn = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'}`

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {(Object.keys(VIEW_LABEL) as ViewMode[]).map((m) => (
            <button key={m} className={btn(mode === m)} onClick={() => setMode(m)}>
              {tr(VIEW_LABEL[m])}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
        <button className={btn(false)} onClick={() => scrollToToday()}>
          {tr('gantt_today')}
        </button>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={showCritical} onChange={(e) => setShowCritical(e.target.checked)} />
          {tr('gantt_critical')}
        </label>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr('gantt_drag_hint')} {tr('plan_finish')}: <b>{formatDate(sched.finish) || '—'}</b>
      </p>
      {bars.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 dark:border-white/15">{tr('gantt_no_dates')}</p>
      ) : (
        <div
          ref={host}
          data-testid="gantt"
          className={`gx-host overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#1d1d29] ${showCritical ? 'gx-show-critical' : ''}`}
        />
      )}
    </div>
  )
}
