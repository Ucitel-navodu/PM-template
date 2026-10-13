import type { Settings } from '../types'

// Local YYYY-MM-DD. Avoids toISOString(), which is UTC: in CET/CEST local
// midnight would map to the previous day.
export function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isWorkingDay(d: Date, settings: Settings): boolean {
  if (!settings.workingDays.includes(d.getDay())) return false
  const key = toDateKey(d)
  return !settings.holidays.some((h) => h.date === key)
}

export function countWorkdays(from: string, to: string, settings: Settings): number {
  if (!from || !to) return 0
  const start = parseDateKey(from)
  const end = parseDateKey(to)
  let count = 0
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (isWorkingDay(d, settings)) count++
  }
  return count
}

export function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom.slice(0, 10) <= bTo.slice(0, 10) && bFrom.slice(0, 10) <= aTo.slice(0, 10)
}
