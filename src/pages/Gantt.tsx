import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { computeHealth } from '../lib/health'
import { HEALTH_COLOR, HEALTH_COLOR_DARK } from '../data/config'
import { formatDate } from '../lib/format'

type AxisMode = 'week' | 'month' | 'quarter'

const MS_DAY = 86400000
const ROW_H = 32

export function GanttPage() {
  const { tr, tasks, theme } = useApp()
  const healthColor = theme === 'dark' ? HEALTH_COLOR_DARK : HEALTH_COLOR
  const [mode, setMode] = useState<AxisMode>('month')

  const scheduled = useMemo(
    () => tasks.filter((t) => t.currentStart && t.currentFinish).sort((a, b) => (a.mgmtOrder ?? 0) - (b.mgmtOrder ?? 0)),
    [tasks],
  )

  const { axisStart, axisEnd, periods } = useMemo(() => {
    if (scheduled.length === 0) {
      const now = new Date()
      return { axisStart: now, axisEnd: now, periods: [] as { label: string; x: number; w: number }[] }
    }
    const starts = scheduled.map((t) => new Date(t.currentStart!).getTime())
    const ends = scheduled.map((t) => new Date(t.currentFinish!).getTime())
    let start = new Date(Math.min(...starts))
    let end = new Date(Math.max(...ends))
    start = new Date(start.getTime() - 14 * MS_DAY)
    end = new Date(end.getTime() + 14 * MS_DAY)

    const periods: { label: string; x: number; w: number }[] = []
    const total = end.getTime() - start.getTime()
    const pos = (d: Date) => ((d.getTime() - start.getTime()) / total) * 100

    if (mode === 'month' || mode === 'quarter') {
      const step = mode === 'month' ? 1 : 3
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
      while (cursor < end) {
        const periodStart = cursor < start ? start : cursor
        const periodEndRaw = new Date(cursor.getFullYear(), cursor.getMonth() + step, 1)
        const periodEnd = periodEndRaw > end ? end : periodEndRaw
        const label =
          mode === 'month'
            ? cursor.toLocaleDateString('cs-CZ', { month: 'short', year: '2-digit' })
            : `Q${Math.floor(cursor.getMonth() / 3) + 1} ${cursor.getFullYear()}`
        periods.push({ label, x: pos(periodStart), w: pos(periodEnd) - pos(periodStart) })
        cursor.setMonth(cursor.getMonth() + step)
      }
    } else {
      const cursor = new Date(start)
      cursor.setDate(cursor.getDate() - cursor.getDay())
      while (cursor < end) {
        const periodStart = cursor < start ? start : cursor
        const periodEndRaw = new Date(cursor.getTime() + 7 * MS_DAY)
        const periodEnd = periodEndRaw > end ? end : periodEndRaw
        periods.push({
          label: cursor.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' }),
          x: pos(periodStart),
          w: pos(periodEnd) - pos(periodStart),
        })
        cursor.setDate(cursor.getDate() + 7)
      }
    }

    return { axisStart: start, axisEnd: end, periods }
  }, [scheduled, mode])

  const pos = (d: Date) => {
    const total = axisEnd.getTime() - axisStart.getTime()
    if (total <= 0) return 0
    return ((d.getTime() - axisStart.getTime()) / total) * 100
  }

  const todayX = pos(new Date())

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">{tr('gantt_axis_mode')}:</span>
        {(['week', 'month', 'quarter'] as AxisMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1 text-sm font-medium ${
              mode === m
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10'
            }`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#1d1d29]">
        <div className="flex min-w-[900px]">
          {/* fixed label column */}
          <div className="w-64 shrink-0 border-r border-gray-200 dark:border-white/10">
            <div style={{ height: 28 }} className="border-b border-gray-200 dark:border-white/10" />
            {scheduled.map((task) => (
              <div
                key={task.id}
                style={{ height: ROW_H }}
                className="flex items-center truncate border-b border-gray-50 pl-3 pr-2 text-sm text-gray-700 last:border-0 dark:border-white/5 dark:text-gray-200"
                title={task.name}
              >
                {task.milestone ? '◆ ' : ''}
                {task.name}
              </div>
            ))}
          </div>

          {/* timeline column: all percentage positioning is relative to this element only */}
          <div className="relative flex-1">
            <div
              className="relative border-b border-gray-200 text-xs text-gray-500 dark:border-white/10 dark:text-gray-400"
              style={{ height: 28 }}
            >
              {periods.map((p, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full truncate border-l border-gray-100 pl-1 pt-1.5 dark:border-white/10"
                  style={{ left: `${p.x}%`, width: `${p.w}%` }}
                >
                  {p.label}
                </div>
              ))}
            </div>

            <div className="relative">
              {todayX >= 0 && todayX <= 100 && (
                <div
                  className="pointer-events-none absolute bottom-0 top-0 z-10 border-l-2 border-dashed border-brand-500"
                  style={{ left: `${todayX}%` }}
                  title={tr('gantt_today')}
                />
              )}
              {scheduled.map((task) => {
                const health = computeHealth(task)
                const start = new Date(task.currentStart!)
                const finish = new Date(task.currentFinish!)
                const left = pos(start)
                const width = Math.max(pos(finish) - left, 0.4)
                const color = health ? healthColor[health] : '#9ca3af'
                return (
                  <div
                    key={task.id}
                    style={{ height: ROW_H }}
                    className="relative border-b border-gray-50 last:border-0 dark:border-white/5"
                  >
                    <div
                      className="absolute top-1/2 h-5 -translate-y-1/2 rounded"
                      style={{
                        left: `${left}%`,
                        width: task.milestone ? '10px' : `${width}%`,
                        backgroundColor: color,
                      }}
                      title={`${formatDate(task.currentStart)} → ${formatDate(task.currentFinish)}`}
                    >
                      {!task.milestone && task.percentComplete != null && (
                        <div
                          className="h-full rounded bg-black/25"
                          style={{ width: `${Math.round(task.percentComplete * 100)}%` }}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
