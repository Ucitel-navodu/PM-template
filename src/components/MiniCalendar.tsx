import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { computeHealth } from '../lib/health'
import type { Task } from '../types'

const DAY_MS = 86400000

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

type DotKind = 'done' | 'overdue' | 'upcoming'

function dotForTask(task: Task): DotKind {
  if (task.status === 'Done') return 'done'
  const health = computeHealth(task)
  if (health === 'Red') return 'overdue'
  return 'upcoming'
}

const DOT_CLASS: Record<DotKind, string> = {
  done: 'bg-emerald-500',
  overdue: 'bg-rose-500',
  upcoming: 'bg-sky-500',
}

export function MiniCalendar({ tasks }: { tasks: Task[] }) {
  const { tr } = useApp()
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const weekdayLabels: string[] = [
    tr('weekday_mon'),
    tr('weekday_tue'),
    tr('weekday_wed'),
    tr('weekday_thu'),
    tr('weekday_fri'),
    tr('weekday_sat'),
    tr('weekday_sun'),
  ]

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    tasks.forEach((task) => {
      if (!task.currentFinish) return
      const key = task.currentFinish.slice(0, 10)
      const list = map.get(key) ?? []
      list.push(task)
      map.set(key, list)
    })
    return map
  }, [tasks])

  const cells = useMemo(() => {
    const firstOfMonth = viewDate
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7 // Monday = 0
    const gridStart = new Date(firstOfMonth.getTime() - firstWeekday * DAY_MS)
    return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * DAY_MS))
  }, [viewDate])

  const today = new Date()
  const monthLabel = viewDate.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          className="rounded px-1.5 py-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
          aria-label="prev month"
        >
          ‹
        </button>
        <span className="text-sm font-medium capitalize text-gray-700 dark:text-gray-200">{monthLabel}</span>
        <button
          onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          className="rounded px-1.5 py-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
          aria-label="next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px]">
        {weekdayLabels.map((w) => (
          <div key={w} className="font-medium uppercase text-gray-400 dark:text-gray-500">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          const inMonth = day.getMonth() === viewDate.getMonth()
          const isToday = sameDay(day, today)
          const dayTasks = tasksByDay.get(day.toISOString().slice(0, 10)) ?? []
          const kinds = new Set(dayTasks.map(dotForTask))
          return (
            <div key={i} className="flex flex-col items-center gap-0.5 py-0.5">
              <div
                title={dayTasks.map((t) => t.name).join('\n') || undefined}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday
                    ? 'bg-brand-600 font-semibold text-white'
                    : inMonth
                      ? 'text-gray-700 dark:text-gray-300'
                      : 'text-gray-300 dark:text-gray-600'
                }`}
              >
                {day.getDate()}
              </div>
              <div className="flex h-1.5 gap-0.5">
                {(['done', 'overdue', 'upcoming'] as DotKind[])
                  .filter((k) => kinds.has(k))
                  .map((k) => (
                    <span key={k} className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[k]}`} />
                  ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-gray-100 pt-2 text-[11px] text-gray-500 dark:border-white/10 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {tr('dash_calendar_legend_done')}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> {tr('dash_calendar_legend_upcoming')}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> {tr('dash_calendar_legend_overdue')}
        </span>
      </div>
    </div>
  )
}
