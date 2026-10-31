import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useActiveProject } from '../store/workspaceStore'
import { usePrefsStore } from '../store/prefsStore'
import { downloadCsv } from '../lib/csv'
import { btnSecondary, selectFilter, tableWrap, tbodyRow, theadRow } from '../lib/ui'
import type { TKey } from '../i18n'
import type { AuditEntity, AuditEntry } from '../types'

const ENTITIES: AuditEntity[] = ['task', 'milestone', 'budget', 'raid', 'change', 'project', 'lists']
const LIMIT = 500

export function AuditPage() {
  const { tr, lang } = useApp()
  const project = useActiveProject()
  const userName = usePrefsStore((s) => s.userName)
  const log = useMemo(() => project?.auditLog ?? [], [project?.auditLog])
  const [entity, setEntity] = useState('')
  const [user, setUser] = useState('')
  const [text, setText] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const users = useMemo(() => [...new Set(log.map((e) => e.user))].sort(), [log])
  const rows = useMemo(() => {
    const q = text.trim().toLowerCase()
    return [...log]
      .reverse()
      .filter(
        (e) =>
          (!entity || e.entity === entity) &&
          (!user || e.user === user) &&
          (!from || e.at.slice(0, 10) >= from) &&
          (!to || e.at.slice(0, 10) <= to) &&
          (!q || `${e.label} ${e.field ?? ''} ${e.old ?? ''} ${e.new ?? ''}`.toLowerCase().includes(q)),
      )
  }, [log, entity, user, text, from, to])

  const fmt = (iso: string) => new Date(iso).toLocaleString(lang === 'CZ' ? 'cs-CZ' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })
  const change = (e: AuditEntry) =>
    e.action === 'create' ? (e.new ? `${tr('audit_create')}: ${e.new}` : tr('audit_create')) : e.action === 'delete' ? tr('audit_delete') : `${e.old || '∅'} → ${e.new || '∅'}`

  const exportCsv = () =>
    downloadCsv(
      'history.csv',
      rows.map((e) => ({ When: e.at, Who: e.user, Area: e.entity, Id: e.entityId, Item: e.label, Action: e.action, Field: e.field ?? '', Old: e.old ?? '', New: e.new ?? '' })),
    )

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{tr('audit_help')}</p>
      {!userName.trim() && (
        <div role="note" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {tr('audit_name_missing')}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={tr('plan_search')} className={`${selectFilter} w-44`} />
        <select value={entity} onChange={(e) => setEntity(e.target.value)} className={selectFilter}>
          <option value="">{tr('audit_all_entities')}</option>
          {ENTITIES.map((x) => (
            <option key={x} value={x}>
              {tr(`audit_e_${x}` as TKey)}
            </option>
          ))}
        </select>
        <select value={user} onChange={(e) => setUser(e.target.value)} className={selectFilter}>
          <option value="">{tr('audit_all_users')}</option>
          {users.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {tr('audit_from')}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectFilter} />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {tr('audit_to')}
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectFilter} />
        </label>
        <div className="flex-1" />
        <button className={btnSecondary} onClick={exportCsv}>
          {tr('audit_export')}
        </button>
      </div>
      <div className={tableWrap}>
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className={theadRow}>
              <th className="px-3 py-2">{tr('audit_when')}</th>
              <th className="px-3 py-2">{tr('audit_who')}</th>
              <th className="px-3 py-2">{tr('audit_what')}</th>
              <th className="px-3 py-2">{tr('audit_field')}</th>
              <th className="px-3 py-2">{tr('audit_change')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, LIMIT).map((e, i) => (
              <tr key={`${e.at}-${i}`} className={tbodyRow}>
                <td className="whitespace-nowrap px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">{fmt(e.at)}</td>
                <td className="whitespace-nowrap px-3 py-1.5">{e.user}</td>
                <td className="px-3 py-1.5">
                  <span className="mr-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 dark:bg-white/10 dark:text-gray-300">{tr(`audit_e_${e.entity}` as TKey)}</span>
                  {e.label}
                </td>
                <td className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">{e.field ?? ''}</td>
                <td className={`px-3 py-1.5 ${e.action === 'delete' ? 'text-rose-600' : e.action === 'create' ? 'text-emerald-600' : ''}`}>{change(e)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-sm text-gray-400">{tr('audit_empty')}</p>}
        {rows.length > LIMIT && <p className="p-3 text-center text-xs text-gray-400">{tr('audit_more').replace('{n}', String(LIMIT))}</p>}
      </div>
    </div>
  )
}
