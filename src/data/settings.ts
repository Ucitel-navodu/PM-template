import type { CalendarSettings, Holiday, ProjectLists, Settings, Status } from '../types'

export const STATUS_KINDS: Status[] = ['Not started', 'In progress', 'On hold', 'Delayed', 'Cancelled', 'Done']

// Defaults transcribed from the CONFIG sheet of the original workbook.
// Note: the workbook lists Easter Monday 2026 as 07.04.2026; Easter Sunday
// 2026 is 5 April, so Easter Monday is 6 April - corrected here.
export const defaultSettings: Settings = {
  phases: ['INITIATION', 'PLANNING', 'REALIZATION', 'CLOSING'],
  projectAreas: ['RFI', 'Tender', 'Implementation'],
  budgetCategories: ['License', 'HW/SW', 'Services', 'Development', 'Implementation', 'Contingency', 'Other'],
  // Status names from the workbook; each maps to a fixed meaning (kind).
  statuses: STATUS_KINDS.map((kind) => ({ name: kind, kind })),
  priorities: ['Very High', 'High', 'Medium', 'Low', 'Very Low', 'On Hold'],
  // Generated for the current and next year (algorithmic Easter, so the
  // workbook's 07.04.2026 error cannot recur).
  holidays: [...czechHolidays(new Date().getFullYear()), ...czechHolidays(new Date().getFullYear() + 1)],
  workingDays: [1, 2, 3, 4, 5],
  orangeTolerance: 0.1,
  redTolerance: 0.25,
}

// Fill in any fields missing from older saved/exported data.
export function withSettingsDefaults(partial: Partial<Settings> | undefined): Settings {
  return { ...defaultSettings, ...(partial ?? {}) }
}

export const defaultLists: ProjectLists = {
  phases: defaultSettings.phases,
  projectAreas: defaultSettings.projectAreas,
  budgetCategories: defaultSettings.budgetCategories,
  statuses: defaultSettings.statuses,
  priorities: defaultSettings.priorities,
}

export const defaultCalendar: CalendarSettings = {
  holidays: defaultSettings.holidays,
  workingDays: defaultSettings.workingDays,
  orangeTolerance: defaultSettings.orangeTolerance,
  redTolerance: defaultSettings.redTolerance,
}

// Easter Sunday, Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

// Czech public holidays (zákon č. 245/2000 Sb.) for a given year.
export function czechHolidays(year: number): Holiday[] {
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (m: number, d: number) => `${year}-${pad(m)}-${pad(d)}`
  const easter = easterSunday(year)
  const shift = (days: number) => {
    const dt = new Date(year, easter.month - 1, easter.day + days)
    return iso(dt.getMonth() + 1, dt.getDate())
  }
  return [
    { date: iso(1, 1), name: 'Nový rok, Den obnovy samostatného českého státu' },
    { date: shift(-2), name: 'Velký pátek' },
    { date: shift(1), name: 'Velikonoční pondělí' },
    { date: iso(5, 1), name: 'Svátek práce' },
    { date: iso(5, 8), name: 'Den vítězství' },
    { date: iso(7, 5), name: 'Den slovanských věrozvěstů Cyrila a Metoděje' },
    { date: iso(7, 6), name: 'Den upálení mistra Jana Husa' },
    { date: iso(9, 28), name: 'Den české státnosti' },
    { date: iso(10, 28), name: 'Den vzniku samostatného československého státu' },
    { date: iso(11, 17), name: 'Den boje za svobodu a demokracii' },
    { date: iso(12, 24), name: 'Štědrý den' },
    { date: iso(12, 25), name: '1. svátek vánoční' },
    { date: iso(12, 26), name: '2. svátek vánoční' },
  ]
}
