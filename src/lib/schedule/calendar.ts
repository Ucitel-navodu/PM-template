import type { CalendarSettings } from '../../types'
import { parseDateKey, toDateKey } from '../dates'

/**
 * Working-day calendar used by the scheduler. Dates are mapped to "working
 * day ordinals" (0, 1, 2 … counting only working days from an origin), so the
 * CPM passes are plain integer arithmetic - the usual way schedulers handle
 * calendars. Non-working dates map to the next working day.
 *
 * Day stepping uses calendar arithmetic (setDate), never +24 h, so the
 * CET/CEST switch cannot skip or repeat a day.
 */
export class WorkCalendar {
  private readonly workingDays: Set<number>
  private readonly holidays: Set<string>
  private readonly origin: Date
  private readonly days: string[] = [] // ordinal -> date key
  private readonly ordinals = new Map<string, number>() // working date key -> ordinal
  private cursor: Date // next date to examine when extending

  constructor(settings: Pick<CalendarSettings, 'workingDays' | 'holidays'>, origin: string) {
    this.workingDays = new Set(settings.workingDays.length ? settings.workingDays : [1, 2, 3, 4, 5])
    this.holidays = new Set(settings.holidays.map((h) => h.date))
    this.origin = parseDateKey(origin)
    this.cursor = new Date(this.origin)
  }

  isWorkingDay(key: string): boolean {
    const d = parseDateKey(key)
    return this.workingDays.has(d.getDay()) && !this.holidays.has(key)
  }

  private extendTo(ordinal: number): void {
    let guard = 0
    while (this.days.length <= ordinal) {
      const key = toDateKey(this.cursor)
      if (this.workingDays.has(this.cursor.getDay()) && !this.holidays.has(key)) {
        this.ordinals.set(key, this.days.length)
        this.days.push(key)
      }
      this.cursor.setDate(this.cursor.getDate() + 1)
      if (++guard > 400_000) throw new Error('Calendar has no working days')
    }
  }

  /** Working-day ordinal of a date; a non-working date maps to the next working day. */
  ordinal(key: string): number {
    if (parseDateKey(key) < this.origin) return 0
    const known = this.ordinals.get(key)
    if (known !== undefined) return known
    // Extend until we have passed the requested date.
    while (this.days.length === 0 || this.days[this.days.length - 1] < key) this.extendTo(this.days.length)
    const exact = this.ordinals.get(key)
    if (exact !== undefined) return exact
    // Non-working day: first working day after it.
    let lo = 0
    let hi = this.days.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.days[mid] < key) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  /** Date key of a working-day ordinal. */
  date(ordinal: number): string {
    const i = Math.max(0, ordinal)
    this.extendTo(i)
    return this.days[i]
  }

  /** Number of working days in [from, to] inclusive (0 if to < from). */
  workdaysBetween(from: string, to: string): number {
    if (to < from) return 0
    const end = this.ordinal(to)
    const endIsWorking = this.days[end] === to.slice(0, 10)
    return Math.max(0, end - this.ordinal(from) + (endIsWorking ? 1 : 0))
  }

  addWorkdays(key: string, n: number): string {
    return this.date(this.ordinal(key) + n)
  }
}

/** Origin for the ordinal space: well before anything in the project. */
export function calendarOrigin(dates: (string | undefined)[]): string {
  const valid = dates.filter((d): d is string => Boolean(d)).sort()
  const first = valid[0] ? parseDateKey(valid[0]) : new Date()
  return toDateKey(new Date(first.getFullYear() - 1, 0, 1))
}
