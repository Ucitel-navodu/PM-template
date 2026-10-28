import { useMemo } from 'react'
import type { Roadmap as RoadmapData, RoadmapItem } from '../lib/report'
import { parseDateKey } from '../lib/dates'
import { HEALTH_COLOR } from '../data/config'

export const PHASE_PALETTE = ['#4f46e5', '#0891b2', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#0d9488', '#dc2626']

export type ColorBy = 'phase' | 'health'

export function itemColor(item: RoadmapItem, colorBy: ColorBy, phases: string[]): string {
  if (colorBy === 'health') return item.health ? HEALTH_COLOR[item.health] : HEALTH_COLOR.Grey
  const i = phases.indexOf(item.phase)
  return PHASE_PALETTE[(i < 0 ? phases.length : i) % PHASE_PALETTE.length]
}

/** Month boundaries between start and end, with a label every month or quarter. */
export function timeline(start: string, end: string) {
  const s = parseDateKey(start)
  const e = parseDateKey(end)
  const from = new Date(s.getFullYear(), s.getMonth(), 1)
  const to = new Date(e.getFullYear(), e.getMonth() + 1, 1)
  const span = to.getTime() - from.getTime()
  const x = (key: string) => (parseDateKey(key).getTime() - from.getTime()) / span
  const months: { x: number; date: Date }[] = []
  for (let d = new Date(from); d <= to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push({ x: (d.getTime() - from.getTime()) / span, date: d })
  return { x, months, quarterly: months.length > 18 }
}

const LABEL_W = 150
const W = 1100
const ROW_H = 26
const HEAD_H = 34

/** Management roadmap: swimlanes, bars and milestone diamonds (the workbook's RoadMap sheet). */
export function Roadmap({ data, colorBy, phases, lang, today = new Date() }: { data: RoadmapData; colorBy: ColorBy; phases: string[]; lang: 'CZ' | 'EN'; today?: Date }) {
  const tl = useMemo(() => timeline(data.start, data.end), [data.start, data.end])
  // One row per item, like the workbook's RoadMap: labels never collide.
  const lanes = useMemo(() => data.lanes.map((l) => ({ ...l, rows: l.items.map((i) => [i]) })), [data.lanes])
  const height = HEAD_H + lanes.reduce((h, l) => h + Math.max(1, l.rows.length) * ROW_H + 8, 0)
  const px = (key: string) => LABEL_W + tl.x(key) * (W - LABEL_W)
  const locale = lang === 'CZ' ? 'cs-CZ' : 'en-GB'
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const todayX = todayKey >= data.start && todayKey <= data.end ? px(todayKey) : null

  let y = HEAD_H
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="roadmap w-full" role="img" aria-label="Roadmap" data-testid="roadmap">
      {tl.months.map((m, i) => {
        const x = LABEL_W + m.x * (W - LABEL_W)
        const q = m.date.getMonth() % 3 === 0
        const label = tl.quarterly ? (q ? `Q${m.date.getMonth() / 3 + 1} ${m.date.getFullYear()}` : '') : m.date.toLocaleDateString(locale, { month: 'short', year: m.date.getMonth() === 0 || i === 0 ? '2-digit' : undefined })
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={HEAD_H - 6} y2={height} className={q ? 'stroke-gray-300 dark:stroke-white/20' : 'stroke-gray-100 dark:stroke-white/5'} />
            {label && i < tl.months.length - 1 && (
              <text x={x + 3} y={20} className="fill-gray-500 text-[11px] dark:fill-gray-400">
                {label}
              </text>
            )}
          </g>
        )
      })}
      {lanes.map((lane, li) => {
        const top = y
        const h = Math.max(1, lane.rows.length) * ROW_H + 8
        y += h
        return (
          <g key={lane.name}>
            <rect x={0} y={top} width={W} height={h} className={li % 2 ? 'fill-gray-50 dark:fill-white/[0.03]' : 'fill-transparent'} />
            <text x={8} y={top + h / 2 + 4} className="fill-gray-700 text-[12px] font-semibold dark:fill-gray-200">
              {lane.name}
            </text>
            {lane.rows.map((row, ri) =>
              row.map((it) => {
                const cy = top + 4 + ri * ROW_H + ROW_H / 2
                const color = itemColor(it, colorBy, phases)
                if (it.milestone) {
                  const x = px(it.start)
                  const leftSide = x + 11 + it.name.length * 6 > W
                  return (
                    <g key={it.id}>
                      <path d={`M${x} ${cy - 8} L${x + 8} ${cy} L${x} ${cy + 8} L${x - 8} ${cy} Z`} fill={color} />
                      <text x={leftSide ? x - 11 : x + 11} y={cy + 4} textAnchor={leftSide ? 'end' : 'start'} className="fill-gray-800 text-[11px] dark:fill-gray-100">
                        {it.name}
                      </text>
                    </g>
                  )
                }
                const x1 = px(it.start)
                const x2 = Math.max(x1 + 3, px(it.finish) + (W - LABEL_W) / 900)
                const fits = (x2 - x1) > it.name.length * 6 + 8
                // Outside label goes left of the bar when it would run off the right edge.
                const leftSide = !fits && x2 + 4 + it.name.length * 6 > W
                return (
                  <g key={it.id}>
                    <rect x={x1} y={cy - 9} width={x2 - x1} height={18} rx={4} fill={color} />
                    <text
                      x={fits ? x1 + 5 : leftSide ? x1 - 4 : x2 + 4}
                      y={cy + 4}
                      textAnchor={leftSide ? 'end' : 'start'}
                      className={`text-[11px] ${fits ? 'fill-white' : 'fill-gray-800 dark:fill-gray-100'}`}
                    >
                      {it.name}
                    </text>
                  </g>
                )
              }),
            )}
          </g>
        )
      })}
      {todayX !== null && <line x1={todayX} x2={todayX} y1={HEAD_H - 6} y2={height} stroke="#e11d48" strokeWidth={1.5} strokeDasharray="4 3" />}
    </svg>
  )
}
