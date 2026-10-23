import { statusKind } from '../lib/status'
import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { computeHealth } from '../lib/health'
import { isWorkingDay, toDateKey } from '../lib/dates'
import type { Settings, Task } from '../types'

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

type DotKind = 'done' | 'overdue' | 'upcoming'

function dotForTask(task: Task, settings: Settings): DotKind {
  if (statusKind(task.status, settings.statuses) === 'Done') return 'done'
  const health = computeHealth(task, settings)
  if (health === 'Red') return 'overdue'
  return 'upcoming'
}

const DOT_CLASS: Record<DotKind, string> = {
  done: 'bg-emerald-500',
  overdue: 'bg-rose-500',
  upcoming: 'bg-sky-500',
}

export function MiniCalendar({ tasks }: { tasks: Task[] }) {
  const { tr, lang, settings, absences } = useApp()
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
    // Build via calendar arithmetic, not +24h in ms: the latter breaks across
    // the DST switch (late March / late October) and repeats a day.
    const y = firstOfMonth.getFullYear()
    const m = firstOfMonth.getMonth()
    return Array.from({ length: 42 }, (_, i) => new Date(y, m, 1 - firstWeekday + i))
  }, [viewDate])

  const today = new Date()
  const monthLabel = viewDate.toLocaleDateString(lang === 'CZ' ? 'cs-CZ' : 'en-GB', { month: 'long', year: 'numeric' })

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
          const key = toDateKey(day)
          const dayTasks = tasksByDay.get(key) ?? []
          const kinds = new Set(dayTasks.map((t) => dotForTask(t, settings)))
          const holiday = settings.holidays.find((h) => h.date === key)
          const dayAbsences = absences.filter((a) => a.from <= key && key <= a.to)
          const working = isWorkingDay(day, settings)
          const tooltip = [
            ...(holiday ? [`🎉 ${holiday.name}`] : []),
            ...dayAbsences.map((a) => `✈️ ${a.person}`),
            ...dayTasks.map((t) => t.name),
          ].join('\n')
          return (
            <div key={i} className="flex flex-col items-center gap-0.5 py-0.5">
              <div
                title={tooltip || undefined}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday
                    ? 'bg-brand-600 font-semibold text-white'
                    : holiday && inMonth
                      ? 'bg-rose-100 font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                      : !inMonth
                        ? 'text-gray-300 dark:text-gray-600'
                        : working
                          ? 'text-gray-700 dark:text-gray-300'
                          : 'text-gray-400 dark:text-gray-500'
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
                {dayAbsences.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />}
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
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> {tr('dash_calendar_legend_absence')}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-100 dark:bg-rose-500/30" /> {tr('dash_calendar_legend_holiday')}
        </span>
      </div>
    </div>
  )
}
