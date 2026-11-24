import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { STATUS_ICON_GROUPS } from '../lib/status'
import type { SettingsPanelId } from '../lib/settingsNav'
import { useApp, type ListKey } from '../context/AppContext'
import { defaultSettings } from '../data/settings'
import type { TKey } from '../i18n'
import { btnPrimary, btnSecondary, inputGhost } from '../lib/ui'
import { usePrefsStore } from '../store/prefsStore'
import { useActiveProject, useWorkspaceStore } from '../store/workspaceStore'
import { STATUS_KINDS } from '../data/settings'
import { PALETTES, type PaletteId } from '../lib/palettes'
import { BrandSymbol, Logo } from './Brand'
import { STATUS_ICON } from '../data/config'
import type { Status, StatusDef } from '../types'

const inputBox =
  'rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-white/15 dark:bg-[rgb(var(--pm-bg))] dark:text-gray-100'

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

/** Icon choice for a status: emoji grouped by category, or the default of the meaning. */
function IconPicker({ value, fallback, disabled, onChange }: { value?: string; fallback: string; disabled?: boolean; onChange: (icon: string | undefined) => void }) {
  const { tr } = useApp()
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!at) return
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAt(null)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopImmediatePropagation(), setAt(null))
    document.addEventListener('mousedown', away)
    window.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('mousedown', away)
      window.removeEventListener('keydown', key, true)
    }
  }, [at])
  const pick = (icon: string | undefined) => {
    onChange(icon)
    setAt(null)
  }
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        data-icon-picker
        title={tr('settings_status_icon')}
        aria-label={tr('settings_status_icon')}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setAt(at ? null : { x: Math.min(r.left, window.innerWidth - 330), y: r.bottom + 4 + 360 > window.innerHeight ? Math.max(8, r.top - 364) : r.bottom + 4 })
        }}
        className="h-8 w-9 shrink-0 rounded-md border border-gray-300 text-base hover:bg-gray-50 disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/10"
      >
        {value || fallback}
      </button>
      {at &&
        createPortal(
          <div ref={ref} role="dialog" aria-label={tr('settings_status_icon')} data-testid="icon-picker" style={{ left: at.x, top: at.y }} className="fixed z-[60] max-h-[360px] w-[320px] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[rgb(var(--pm-card))]">
            <button className="mb-1 w-full rounded px-2 py-1 text-left text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10" onClick={() => pick(undefined)}>
              {fallback} {tr('settings_status_icon_default')}
            </button>
            {STATUS_ICON_GROUPS.map((g) => (
              <div key={g.key} className="mt-1">
                <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{tr(`icons_${g.key}` as TKey)}</div>
                <div className="grid grid-cols-10 gap-0.5">
                  {g.icons.map((ic) => (
                    <button key={ic} data-icon={ic} onClick={() => pick(ic)} className={`h-7 rounded text-base hover:bg-gray-100 dark:hover:bg-white/10 ${ic === value ? 'ring-2 ring-brand-600' : ''}`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
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
          <IconPicker value={st.icon} fallback={STATUS_ICON[st.kind]} disabled={readOnly} onChange={(icon) => set(statuses.map((x, j) => (j === i ? { ...x, icon } : x)))} />
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

/** ORLEN Unipetrol look: light (default) or dark; colours follow the brand manual and cannot be changed. */
function AppearanceSection() {
  const { tr } = useApp()
  const { palette, setPalette } = usePrefsStore()
  const move = (id: PaletteId) => {
    const next = PALETTES.find((p) => p.id !== id)!.id
    setPalette(next)
    setTimeout(() => document.querySelector<HTMLElement>(`[data-palette="${next}"]`)?.focus())
  }
  return (
    <Section title={tr('settings_appearance')} help={tr('settings_appearance_help')}>
      <div role="radiogroup" aria-label={tr('settings_appearance')} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PALETTES.map((p) => {
          const on = p.id === palette
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              data-palette={p.id}
              onClick={() => setPalette(p.id)}
              onKeyDown={(e) => {
                if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
                  e.preventDefault()
                  move(p.id)
                }
              }}
              className={`overflow-hidden rounded-lg border text-left text-sm ${on ? 'border-brand-600 ring-2 ring-brand-600' : 'border-gray-300 hover:border-gray-400 dark:border-white/15 dark:hover:border-white/30'}`}
            >
              <span className="relative flex h-20 items-center overflow-hidden px-2" style={{ background: p.swatch[0] }}>
                <Logo height={22} variant={p.dark ? 'negative' : 'color'} />
                <BrandSymbol size={96} corner="top-right" />
              </span>
              <span className="flex items-center justify-between px-3 py-2 text-gray-800 dark:text-gray-100">
                {tr(p.dark ? 'palette_orlen_dark' : 'palette_orlen_light')}
                {!p.dark && <small className="opacity-70">{tr('palette_default')}</small>}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{tr('settings_brand_note')}</p>
    </Section>
  )
}

/** Branding for printed reports and PowerPoint decks (shared by the workspace). */
function ReportSection() {
  const { tr, readOnly } = useApp()
  const rs = useWorkspaceStore((s) => s.workspace.reportSettings)
  const update = useWorkspaceStore.getState().updateReportSettings
  const label = 'flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400'
  return (
    <Section title={tr('report_settings')} help={tr('report_settings_help')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          {tr('report_org')}
          <input className={inputBox} value={rs.organization} onChange={(e) => update({ organization: e.target.value })} disabled={readOnly} />
        </label>
        <label className={label}>
          {tr('report_footer')}
          <input className={inputBox} value={rs.footer} onChange={(e) => update({ footer: e.target.value })} disabled={readOnly} />
        </label>
      </div>
    </Section>
  )
}

const GROUPS = ['settings_group_app', 'settings_group_project', 'settings_group_calendar'] as const
const PANELS: { id: SettingsPanelId; group: (typeof GROUPS)[number]; icon: string; title: TKey; keywords: string }[] = [
  { id: 'appearance', group: 'settings_group_app', icon: '🎨', title: 'settings_appearance', keywords: 'barvy paleta vzhled tmavy svetly korporatni orlen unipetrol logo brand colors palette theme dark light corporate' },
  { id: 'personal', group: 'settings_group_app', icon: '👤', title: 'settings_personal', keywords: 'jmeno ukladani autosave zalohy name save backups soubor file' },
  { id: 'report', group: 'settings_group_app', icon: '📄', title: 'report_settings', keywords: 'report pptx pdf logo organizace paticka organization footer barva' },
  { id: 'phases', group: 'settings_group_project', icon: '🧭', title: 'settings_phases', keywords: 'faze projektu phases' },
  { id: 'areas', group: 'settings_group_project', icon: '🗂️', title: 'settings_project_areas', keywords: 'oblasti projektu areas workstream' },
  { id: 'statuses', group: 'settings_group_project', icon: '🚦', title: 'settings_statuses', keywords: 'stavy status kanban done hotovo' },
  { id: 'priorities', group: 'settings_group_project', icon: '⚡', title: 'settings_priorities', keywords: 'priority priorita' },
  { id: 'budget', group: 'settings_group_project', icon: '💰', title: 'settings_budget_categories', keywords: 'rozpocet kategorie budget categories capex opex' },
  { id: 'calendar', group: 'settings_group_calendar', icon: '📅', title: 'settings_calendar', keywords: 'kalendar svatky pracovni dny holidays working days weekend' },
  { id: 'health', group: 'settings_group_calendar', icon: '❤️', title: 'settings_health', keywords: 'health tolerance orange red zpozdeni delay' },
]
const fold = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function SettingsPanel({ onClose, initial = 'appearance' }: { onClose: () => void; initial?: SettingsPanelId }) {
  const { tr, settings, updateSettings } = useApp()
  const [panel, setPanel] = useState<SettingsPanelId>(initial)
  const [query, setQuery] = useState('')
  const q = fold(query.trim())
  const matches = PANELS.filter((p) => !q || fold(`${tr(p.title)} ${p.keywords}`).includes(q))
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
        className="w-full max-w-4xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[rgb(var(--pm-card))]"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">⚙️ {tr('settings_button')} <span className="font-normal text-gray-400">› {tr(PANELS.find((x) => x.id === panel)!.title)}</span></h2>
          <button
            onClick={onClose}
            aria-label={tr('help_close')}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-[26rem] flex-col sm:flex-row">
          <aside className="shrink-0 border-b border-gray-200 p-3 dark:border-white/10 sm:w-56 sm:border-b-0 sm:border-r">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && matches[0] && (setPanel(matches[0].id), setQuery(''))}
              placeholder={tr('settings_search')}
              aria-label={tr('settings_search')}
              className={`mb-2 w-full ${inputBox}`}
            />
            <nav aria-label={tr('settings_button')} className="flex gap-1 overflow-x-auto sm:block sm:space-y-0.5">
              {GROUPS.map((g) => {
                const items = matches.filter((m) => m.group === g)
                return items.length ? (
                  <div key={g} className="flex gap-1 sm:block">
                    <div className="hidden px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 sm:block">{tr(g)}</div>
                    {items.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        data-settings-nav={m.id}
                        aria-current={panel === m.id ? 'page' : undefined}
                        onClick={() => setPanel(m.id)}
                        className={`flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-left text-sm ${
                          panel === m.id ? 'bg-brand-600 font-medium text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'
                        }`}
                      >
                        <span aria-hidden>{m.icon}</span>
                        {tr(m.title)}
                      </button>
                    ))}
                  </div>
                ) : null
              })}
              {matches.length === 0 && <p className="px-2 py-2 text-xs text-gray-400">{tr('settings_search_none')}</p>}
            </nav>
          </aside>
          <div className="max-h-[70vh] min-w-0 flex-1 overflow-y-auto px-5" data-settings-panel={panel}>
            {panel === 'appearance' && (
              <>
              <AppearanceSection />
              </>
            )}
            {panel === 'personal' && (
              <>
              <PersonalSection />
              </>
            )}
            {panel === 'report' && (
              <>
              <ReportSection />
              </>
            )}
            {panel === 'phases' && (
              <>
              <Section title={tr('settings_phases')} help={tr('settings_phases_help')}>
                <ListEditor list="phases" />
              </Section>
              </>
            )}
            {panel === 'areas' && (
              <>
              <Section title={tr('settings_project_areas')} help={tr('settings_project_areas_help')}>
                <ListEditor list="projectAreas" />
              </Section>
              </>
            )}
            {panel === 'statuses' && (
              <>
              <Section title={tr('settings_statuses')} help={tr('settings_statuses_help')}>
                <StatusEditor />
              </Section>
              </>
            )}
            {panel === 'priorities' && (
              <>
              <Section title={tr('settings_priorities')}>
                <ListEditor list="priorities" />
              </Section>
              </>
            )}
            {panel === 'budget' && (
              <>
              <Section title={tr('settings_budget_categories')}>
                <ListEditor list="budgetCategories" />
              </Section>
              </>
            )}
            {panel === 'calendar' && (
              <>
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
              </>
            )}
            {panel === 'health' && (
              <>
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
              </>
            )}
          </div>
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
