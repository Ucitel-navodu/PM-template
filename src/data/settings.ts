import type { Settings } from '../types'

// Defaults transcribed from the CONFIG sheet of the original workbook.
// Note: the workbook lists Easter Monday 2026 as 07.04.2026; Easter Sunday
// 2026 is 5 April, so Easter Monday is 6 April - corrected here.
export const defaultSettings: Settings = {
  phases: ['INITIATION', 'PLANNING', 'REALIZATION', 'CLOSING'],
  projectAreas: ['RFI', 'Tender', 'Implementation'],
  budgetCategories: ['License', 'HW/SW', 'Services', 'Development', 'Implementation', 'Contingency', 'Other'],
  holidays: [
    { date: '2026-01-01', name: 'Nový rok' },
    { date: '2026-04-03', name: 'Velký pátek' },
    { date: '2026-04-06', name: 'Velikonoční pondělí' },
    { date: '2026-05-01', name: 'Svátek práce' },
    { date: '2026-05-08', name: 'Den vítězství' },
    { date: '2026-07-05', name: 'Cyril a Metoděj' },
    { date: '2026-07-06', name: 'Jan Hus' },
    { date: '2026-09-28', name: 'Den české státnosti' },
    { date: '2026-10-28', name: 'Den vzniku ČSR' },
    { date: '2026-11-17', name: 'Den boje za svobodu a demokracii' },
    { date: '2026-12-24', name: 'Štědrý den' },
    { date: '2026-12-25', name: 'První svátek vánoční' },
    { date: '2026-12-26', name: 'Druhý svátek vánoční' },
  ],
  workingDays: [1, 2, 3, 4, 5],
  orangeTolerance: 0.1,
  redTolerance: 0.25,
}

// Fill in any fields missing from older saved/exported data.
export function withSettingsDefaults(partial: Partial<Settings> | undefined): Settings {
  return { ...defaultSettings, ...(partial ?? {}) }
}
