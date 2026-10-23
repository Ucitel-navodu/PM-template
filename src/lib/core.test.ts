import { describe, expect, it } from 'vitest'
import { czechHolidays, defaultCalendar, easterSunday } from '../data/settings'
import { countWorkdays, isWorkingDay, parseDateKey, toDateKey } from './dates'
import { computeHealth } from './health'
import { nextSequentialId } from './ids'
import type { Settings, Task } from '../types'

const settings = { ...defaultCalendar, phases: [], projectAreas: [], budgetCategories: [], holidays: czechHolidays(2026) } as Settings

describe('holidays', () => {
  it('computes Easter Sunday', () => {
    expect(easterSunday(2024)).toEqual({ month: 3, day: 31 })
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 })
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 })
    expect(easterSunday(2027)).toEqual({ month: 3, day: 28 })
  })

  it('puts Easter Monday 2026 on 6 April (the workbook had 7 April)', () => {
    const h = czechHolidays(2026)
    expect(h.find((x) => x.name === 'Velikonoční pondělí')?.date).toBe('2026-04-06')
    expect(h.find((x) => x.name === 'Velký pátek')?.date).toBe('2026-04-03')
    expect(h).toHaveLength(13)
  })
})

describe('dates (Europe/Prague)', () => {
  it('runs in the Prague timezone', () => {
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120)
  })

  it('keys local dates without a UTC shift', () => {
    expect(toDateKey(new Date(2026, 9, 10))).toBe('2026-10-10')
    expect(toDateKey(parseDateKey('2026-10-25'))).toBe('2026-10-25')
  })

  it('counts workdays across the DST switch, skipping weekends and holidays', () => {
    // 26-30 Oct 2026: 28 Oct is a holiday
    expect(countWorkdays('2026-10-26', '2026-10-30', settings)).toBe(4)
    // DST ends Sun 25 Oct 2026: 19 Oct - 1 Nov = 2 weeks, minus 28 Oct
    expect(countWorkdays('2026-10-19', '2026-11-01', settings)).toBe(9)
    expect(isWorkingDay(new Date(2026, 3, 6), settings)).toBe(false)
  })
})

describe('health (port of the Excel LET formula)', () => {
  const base: Task = { id: 't', wbs: '1', name: 'T', phase: 'P', status: 'In progress', owner: '', percentComplete: 0.5, milestone: false, priority: 'Medium', mgmtExport: false }
  const today = new Date()
  const iso = (d: number) => toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + d))

  it('flags data issues as Blue', () => {
    expect(computeHealth({ ...base, currentStart: iso(5), currentFinish: iso(1) })).toBe('Blue')
    expect(computeHealth({ ...base, status: 'Done', percentComplete: 0.5, currentStart: iso(-5), currentFinish: iso(-1) })).toBe('Blue')
  })

  it('treats a task finishing today as not overdue (TODAY() has no time)', () => {
    expect(computeHealth({ ...base, percentComplete: 0.9, currentStart: iso(-5), currentFinish: iso(0) })).toBe('Green')
  })

  it('is Red when overdue, Green when on track', () => {
    expect(computeHealth({ ...base, currentStart: iso(-10), currentFinish: iso(-1) })).toBe('Red')
    expect(computeHealth({ ...base, percentComplete: 0.5, currentStart: iso(-5), currentFinish: iso(5) })).toBe('Green')
  })

  it('uses the configured tolerances', () => {
    // expected = 6/11 = 0.545 -> gap 0.145
    const t = { ...base, percentComplete: 0.4, currentStart: iso(-5), currentFinish: iso(5) }
    expect(computeHealth(t, { orangeTolerance: 0.1, redTolerance: 0.25 })).toBe('Orange')
    expect(computeHealth(t, { orangeTolerance: 0.5, redTolerance: 0.6 })).toBe('Green')
  })
})

describe('ids', () => {
  it('continues the existing sequence instead of restarting', () => {
    expect(nextSequentialId(['M01', 'M05', 'X9'], 'M', 2)).toBe('M06')
    expect(nextSequentialId([], 'R-', 3)).toBe('R-001')
  })
})
