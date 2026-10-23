import { useEffect, useState } from 'react'
import { useApp, type ListKey } from '../context/AppContext'
import { defaultSettings } from '../data/settings'
import type { TKey } from '../i18n'
import { btnPrimary, btnSecondary, inputGhost } from '../lib/ui'
import { usePrefsStore } from '../store/prefsStore'
import { useActiveProject, useWorkspaceStore } from '../store/workspaceStore'
import { STATUS_KINDS } from '../data/settings'
import { STATUS_ICON } from '../data/config'
import type { Status, StatusDef } from '../types'

const inputBox =
  'rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-white/15 dark:bg-[#14141c] dark:text-gray-100'

function Section({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-gray-100 py-4 last:border-0 dark:border-white/10">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
      {help && <p className="mb-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">{help}</p>}
      <div className={help ? '' : 'mt-2'}>{children}</div>
    </section>
  )
}

function ListItemRow({ list, value, index, count }: { list: ListKey; value: string; index: number; count: number }) {
  const { tr, settings, updateSettings, renameListItem, listItemUsage } = useApp()
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const usage = listItemUsage(list, value)

  const commit = () => {
    const next = draft.trim()
    if (!next || next === value) return setDraft(value)
    if (settings[list].includes(next)) {
      window.alert(tr('settings_duplicate'))
      return setDraft(value)
    }
    renameListItem(list, value, next)
  }

  const move = (dir: -1 | 1) => {
    const arr = [...settings[list]]
    const j = index + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[index], arr[j]] = [arr[j], arr[index]]
    updateSettings({ [list]: arr })
  }

  const remove = () => {
    if (usage > 0) {
      const msg = tr('settings_delete_used').replace('{name}', value).replace('{n}', String(usage))
      if (!window.confirm(msg)) return
    }
    updateSettings({ [list]: settings[list].filter((x) => x !== value) })
  }

  const iconBtn =
    'h-7 w-7 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-gray-200'

  return (
    <div className="flex items-center gap-1">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className={`flex-1 text-sm ${inputGhost}`}
      />
      <span className="w-20 shrink-0 text-right text-xs text-gray-400 dark:text-gray-500">
        {usage > 0 ? tr('settings_used').replace('{n}', String(usage)) : ''}
      </span>
      <button onClick={() => move(-1)} disabled={index === 0} className={iconBtn} aria-label="up">
        ↑
      </button>
      <button onClick={() => move(1)} disabled={index === count - 1} className={iconBtn} aria-label="down">
        ↓
      </button>
      <button onClick={remove} className={`${iconBtn} hover:text-red-600`} aria-label="delete">
        ✕
      </button>
    </div>
  )
}

function ListEditor({ list }: { list: ListKey }) {
  const { tr, settings, updateSettings } = useApp()
  const [newItem, setNewItem] = useState('')
  const items = settings[list]

  const add = () => {
    const v = newItem.trim()
    if (!v) return
    if (items.includes(v)) return window.alert(tr('settings_duplicate'))
    updateSettings({ [list]: [...items, v] })
    setNewItem('')
  }

  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <ListItemRow key={item} list={list} value={item} index={i} count={items.length} />
      ))}
      <div className="flex gap-2 pt-1">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={tr('settings_new_item')}
          className={`flex-1 ${inputBox}`}
        />
        <button onClick={add} className={btnSecondary}>
          {tr('common_add')}
        </button>
      </div>
    </div>
  )
}

/** Task statuses: a user-visible name plus one of the fixed meanings Health and the scheduler use. */
function StatusEditor() {
  const { tr, readOnly } = useApp()
  const project = useActiveProject()
  const store = useWorkspaceStore.getState()
  const statuses = project?.lists.statuses ?? []
  const [newName, setNewName] = useState('')
  const usage = (name: string) => project?.tasks.filter((t) => t.status === name).length ?? 0
  const set = (next: StatusDef[]) => store.setStatuses(next)
  const iconBtn =
    'h-7 w-7 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-gray-200'

  return (
    <div className="space-y-1">
      {statuses.map((st, i) => (
        <div key={st.name} className="flex items-center gap-1">
          <input
            defaultValue={st.name}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (!v || v === st.name) return (e.target.value = st.name)
              if (statuses.some((x) => x.name === v)) {
                window.alert(tr('settings_duplicate'))
                return (e.target.value = st.name)
              }
              store.renameStatus(st.name, v)
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className={`flex-1 text-sm ${inputGhost}`}
            disabled={readOnly}
          />
          <select
            value={st.kind}
            onChange={(e) => set(statuses.map((x, j) => (j === i ? { ...x, kind: e.target.value as Status } : x)))}
            className={`${inputBox} text-xs`}
            aria-label={tr('settings_status_kind')}
            disabled={readOnly}
          >
            {STATUS_KINDS.map((k) => (
              <option key={k} value={k}>
                {STATUS_ICON[k]} {k}
              </option>
            ))}
          </select>
          <span className="w-16 shrink-0 text-right text-xs text-gray-400">{usage(st.name) ? tr('settings_used').replace('{n}', String(usage(st.name))) : ''}</span>
          <button
            className={iconBtn}
            disabled={i === 0 || readOnly}
            aria-label="up"
            onClick={() => set(statuses.map((x, j) => (j === i - 1 ? statuses[i] : j === i ? statuses[i - 1] : x)))}
          >
            ↑
          </button>
          <button
            className={iconBtn}
            disabled={i === statuses.length - 1 || readOnly}
            aria-label="down"
            onClick={() => set(statuses.map((x, j) => (j === i + 1 ? statuses[i] : j === i ? statuses[i + 1] : x)))}
          >
            ↓
          </button>
          <button
            className={`${iconBtn} hover:text-red-600`}
            aria-label="delete"
            disabled={readOnly || statuses.length <= 1 || usage(st.name) > 0}
            title={usage(st.name) > 0 ? tr('settings_status_in_use') : undefined}
            onClick={() => set(statuses.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={tr('settings_new_item')} className={`flex-1 ${inputBox}`} />
        <button
          className={btnSecondary}
          disabled={readOnly}
          onClick={() => {
            const v = newName.trim()
            if (!v) return
            if (statuses.some((x) => x.name === v)) return window.alert(tr('settings_duplicate'))
            set([...statuses, { name: v, kind: 'In progress' }])
            setNewName('')
          }}
        >
          {tr('common_add')}
        </button>
      </div>
    </div>
  )
}

const WEEKDAYS: { day: number; key: TKey }[] = [
  { day: 1, key: 'weekday_mon' },
  { day: 2, key: 'weekday_tue' },
  { day: 3, key: 'weekday_wed' },
  { day: 4, key: 'weekday_thu' },
  { day: 5, key: 'weekday_fri' },
  { day: 6, key: 'weekday_sat' },
  { day: 0, key: 'weekday_sun' },
]

// Per-user, per-device preferences (not stored in the shared workspace file).
function PersonalSection() {
  const { tr } = useApp()
  const prefs = usePrefsStore()
  const label = 'flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400'
  return (
    <Section title={tr('settings_personal')} help={tr('settings_personal_help')}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>
          {tr('settings_user_name')}
          <input
            className={inputBox}
            value={prefs.userName}
            placeholder={tr('settings_user_name_ph')}
            onChange={(e) => prefs.setUserName(e.target.value)}
          />
        </label>
        <label className={label}>
          {tr('settings_autosave')}
          <select className={inputBox} value={prefs.autosaveDelayMs} onChange={(e) => prefs.setAutosaveDelayMs(Number(e.target.value))}>
            {[1000, 2000, 5000, 10000, 30000, 60000].map((ms) => (
              <option key={ms} value={ms}>
                {ms / 1000} s
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          {tr('settings_max_backups')}
          <input
            type="number"
            min={1}
            max={100}
            className={inputBox}
            value={prefs.maxBackups}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value))
              if (n >= 1 && n <= 100) prefs.setMaxBackups(n)
            }}
          />
        </label>
      </div>
    </Section>
  )
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { tr, settings, updateSettings } = useApp()
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const holidays = settings.holidays

  const addHoliday = () => {
    if (!newHoliday.date) return
    updateSettings({
      holidays: [...settings.holidays, { date: newHoliday.date, name: newHoliday.name.trim() }].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    })
    setNewHoliday({ date: '', name: '' })
  }

  const toggleWorkday = (day: number) => {
    const has = settings.workingDays.includes(day)
    updateSettings({ workingDays: has ? settings.workingDays.filter((d) => d !== day) : [...settings.workingDays, day] })
  }

  const setTolerance = (key: 'orangeTolerance' | 'redTolerance', pct: string) => {
    const n = Number(pct)
    if (Number.isFinite(n) && n >= 0) updateSettings({ [key]: n / 100 })
  }

  const resetDefaults = () => {
    if (window.confirm(tr('settings_reset_confirm'))) updateSettings(defaultSettings)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr('settings_button')}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1d1d29]"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">⚙️ {tr('settings_button')}</h2>
          <button
            onClick={onClose}
            aria-label={tr('help_close')}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-5">
          <PersonalSection />

          <Section title={tr('settings_phases')} help={tr('settings_phases_help')}>
            <ListEditor list="phases" />
          </Section>

          <Section title={tr('settings_project_areas')} help={tr('settings_project_areas_help')}>
            <ListEditor list="projectAreas" />
          </Section>

          <Section title={tr('settings_statuses')} help={tr('settings_statuses_help')}>
            <StatusEditor />
          </Section>

          <Section title={tr('settings_priorities')}>
            <ListEditor list="priorities" />
          </Section>

          <Section title={tr('settings_budget_categories')}>
            <ListEditor list="budgetCategories" />
          </Section>

          <Section title={tr('settings_working_days')}>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(({ day, key }) => {
                const on = settings.workingDays.includes(day)
                return (
                  <button
                    key={day}
                    onClick={() => toggleWorkday(day)}
                    className={`w-12 rounded-md border py-1.5 text-sm font-medium ${
                      on
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-gray-300 text-gray-500 dark:border-white/15 dark:text-gray-400'
                    }`}
                  >
                    {tr(key)}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title={tr('settings_holidays')} help={tr('settings_holidays_help')}>
            <div className="space-y-1">
              {holidays.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="date"
                    value={h.date}
                    onChange={(e) =>
                      updateSettings({
                        holidays: settings.holidays.map((x) => (x === h ? { ...x, date: e.target.value } : x)),
                      })
                    }
                    className={`text-sm ${inputGhost}`}
                  />
                  <input
                    value={h.name}
                    onChange={(e) =>
                      updateSettings({
                        holidays: settings.holidays.map((x) => (x === h ? { ...x, name: e.target.value } : x)),
                      })
                    }
                    className={`flex-1 text-sm ${inputGhost}`}
                  />
                  <button
                    onClick={() => updateSettings({ holidays: settings.holidays.filter((x) => x !== h) })}
                    className="h-7 w-7 rounded text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-white/10"
                    aria-label="delete"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <input
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  className={inputBox}
                />
                <input
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addHoliday()}
                  placeholder={tr('settings_new_item')}
                  className={`flex-1 ${inputBox}`}
                />
                <button onClick={addHoliday} className={btnSecondary}>
                  {tr('common_add')}
                </button>
              </div>
            </div>
          </Section>

          <Section title={tr('settings_health')} help={tr('settings_health_help')}>
            <div className="flex flex-wrap gap-6 text-sm text-gray-700 dark:text-gray-300">
              <label className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#e08a00]" />
                {tr('settings_orange')}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(settings.orangeTolerance * 100)}
                  onChange={(e) => setTolerance('orangeTolerance', e.target.value)}
                  className={`w-16 ${inputBox}`}
                />
                %
              </label>
              <label className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#c62828]" />
                {tr('settings_red')}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(settings.redTolerance * 100)}
                  onChange={(e) => setTolerance('redTolerance', e.target.value)}
                  className={`w-16 ${inputBox}`}
                />
                %
              </label>
            </div>
          </Section>
        </div>

        <div className="flex justify-between border-t border-gray-200 px-5 py-3 dark:border-white/10">
          <button onClick={resetDefaults} className={btnSecondary}>
            {tr('settings_reset')}
          </button>
          <button onClick={onClose} className={btnPrimary}>
            {tr('help_close')}
          </button>
        </div>
      </div>
    </div>
  )
}
