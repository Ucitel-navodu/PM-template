import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { Card } from '../components/Card'
import { countWorkdays, rangesOverlap, toDateKey } from '../lib/dates'
import { btnPrimary, deleteBtn, inputGhost, selectGhost, tableWrap, tbodyRow, theadRow } from '../lib/ui'
import type { AbsenceType } from '../types'
import type { TKey } from '../i18n'

const TYPE_LABEL: Record<AbsenceType, TKey> = {
  Vacation: 'absence_vacation',
  'Business trip': 'absence_trip',
  Other: 'absence_other',
}

const TYPE_ICON: Record<AbsenceType, string> = { Vacation: '🏖️', 'Business trip': '✈️', Other: '📌' }

// Equivalent of the TEAM sheet: who is away when, and whether it clashes with
// their own open tasks.
export function TeamPage() {
  const { tr, absences, addAbsence, updateAbsence, deleteAbsence, tasks, settings } = useApp()

  const people = useMemo(() => {
    const names = new Set<string>()
    tasks.forEach((t) => t.owner && names.add(t.owner))
    absences.forEach((a) => a.person && names.add(a.person))
    return [...names].sort((a, b) => a.localeCompare(b, 'cs'))
  }, [tasks, absences])

  const conflictsFor = (person: string, from: string, to: string) =>
    !person || !from || !to
      ? []
      : tasks.filter(
          (t) =>
            t.owner === person &&
            t.status !== 'Done' &&
            t.status !== 'Cancelled' &&
            t.currentStart &&
            t.currentFinish &&
            rangesOverlap(t.currentStart, t.currentFinish, from, to),
        )

  const summary = useMemo(() => {
    const map = new Map<string, { days: number; ranges: string[] }>()
    ;[...absences]
      .sort((a, b) => a.from.localeCompare(b.from))
      .forEach((a) => {
        if (!a.person) return
        const entry = map.get(a.person) ?? { days: 0, ranges: [] }
        entry.days += countWorkdays(a.from, a.to, settings)
        entry.ranges.push(`${TYPE_ICON[a.type]} ${a.from.slice(8, 10)}.${a.from.slice(5, 7)}.–${a.to.slice(8, 10)}.${a.to.slice(5, 7)}.`)
        map.set(a.person, entry)
      })
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'cs'))
  }, [absences, settings])

  const add = () => {
    const today = toDateKey(new Date())
    addAbsence({ id: `a${Date.now().toString(36)}`, person: '', type: 'Vacation', from: today, to: today })
  }

  const th = 'px-3 py-2 whitespace-nowrap'
  const td = 'px-3 py-1.5'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{tr('team_title')}</h2>
        <button onClick={add} className={btnPrimary}>
          {tr('team_add')}
        </button>
      </div>

      <datalist id="team-people">
        {people.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <div className={tableWrap}>
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className={theadRow}>
              <th className={th}>{tr('team_person')}</th>
              <th className={th}>{tr('team_type')}</th>
              <th className={th}>{tr('team_from')}</th>
              <th className={th}>{tr('team_to')}</th>
              <th className={th}>{tr('team_workdays')}</th>
              <th className={th} title={tr('team_conflicts_help')}>
                {tr('team_conflicts')} ⓘ
              </th>
              <th className={th}>{tr('common_notes')}</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {absences.map((a) => {
              const conflicts = conflictsFor(a.person, a.from, a.to)
              const invalid = a.from && a.to && a.to < a.from
              return (
                <tr key={a.id} className={tbodyRow}>
                  <td className={td}>
                    <input
                      list="team-people"
                      value={a.person}
                      onChange={(e) => updateAbsence(a.id, { person: e.target.value })}
                      className={`w-40 ${inputGhost}`}
                    />
                  </td>
                  <td className={td}>
                    <select
                      value={a.type}
                      onChange={(e) => updateAbsence(a.id, { type: e.target.value as AbsenceType })}
                      className={selectGhost}
                    >
                      {(Object.keys(TYPE_LABEL) as AbsenceType[]).map((t) => (
                        <option key={t} value={t}>
                          {TYPE_ICON[t]} {tr(TYPE_LABEL[t])}
                        </option>
                      ))}
                    </select>
                  </td>
                  {(['from', 'to'] as const).map((k) => (
                    <td key={k} className={td}>
                      <input
                        type="date"
                        value={a[k]}
                        onChange={(e) => updateAbsence(a.id, { [k]: e.target.value })}
                        className={`${selectGhost} ${invalid ? 'text-rose-600' : ''}`}
                      />
                    </td>
                  ))}
                  <td className={`${td} text-gray-600 dark:text-gray-300`}>
                    {invalid ? '⚠️' : countWorkdays(a.from, a.to, settings)}
                  </td>
                  <td className={td}>
                    {conflicts.length === 0 ? (
                      <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                    ) : (
                      <span
                        title={conflicts.map((t) => `${t.wbs} ${t.name}`).join('\n')}
                        className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                      >
                        ⚠️ {conflicts.length}
                      </span>
                    )}
                  </td>
                  <td className={td}>
                    <input
                      value={a.note ?? ''}
                      onChange={(e) => updateAbsence(a.id, { note: e.target.value || undefined })}
                      className={`w-56 ${inputGhost}`}
                    />
                  </td>
                  <td className={`${td} text-right`}>
                    <button onClick={() => deleteAbsence(a.id)} className={deleteBtn}>
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Card title={tr('team_summary')} icon="👥" accent="violet">
        {summary.length === 0 ? (
          <p className="text-sm text-gray-400">—</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {summary.map(([person, s]) => (
              <li key={person} className="flex flex-wrap items-baseline gap-x-3">
                <span className="w-40 font-medium text-gray-800 dark:text-gray-100">{person}</span>
                <span className="w-28 text-gray-500 dark:text-gray-400">
                  {tr('team_days_total')}: <b className="text-gray-800 dark:text-gray-100">{s.days}</b>
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{s.ranges.join('  ·  ')}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
