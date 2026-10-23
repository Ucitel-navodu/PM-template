import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useActiveProject } from '../store/workspaceStore'
import { IMPACT_LEVELS, RISK_RESPONSES, RISK_STATUSES, RISK_TYPES } from '../data/config'
import { nextSequentialId } from '../lib/ids'
import { toDateKey } from '../lib/dates'
import { IMPACT_LEVELS_DESC, isScored, riskScore, scoreClass } from '../lib/raid'
import { btnPrimary, btnSecondary, deleteBtn, inputGhost, selectFilter, selectGhost, tableWrap, tbodyRow, theadRow } from '../lib/ui'
import type { TKey } from '../i18n'
import type { ImpactLevel, Risk, RiskType } from '../types'

const IMPACT_COLOR: Record<ImpactLevel, string> = {
  Low: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Medium: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  High: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  Critical: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
}

const TYPE_ICON: Record<RiskType, string> = { Risk: '⚠️', Issue: '🔥', Assumption: '💭', Dependency: '🔗', Decision: '⚖️' }

type Tab = 'all' | RiskType

/** P x I heat map; counts open risks and issues, a click filters the table. */
function Heatmap({ items, cell, onCell }: { items: Risk[]; cell?: [ImpactLevel, ImpactLevel]; onCell: (c?: [ImpactLevel, ImpactLevel]) => void }) {
  const { tr } = useApp()
  const open = items.filter((r) => r.status === 'Open' && isScored(r))
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#1d1d29]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200" title={tr('raid_heatmap_help')}>
          {tr('raid_heatmap')} ⓘ
        </h3>
        {cell && (
          <button className="text-xs text-brand-600 hover:underline dark:text-brand-300" onClick={() => onCell(undefined)}>
            {tr('raid_clear_filter')}
          </button>
        )}
      </div>
      <div className="grid grid-cols-[auto_repeat(4,minmax(2.5rem,1fr))] gap-1 text-xs">
        {IMPACT_LEVELS_DESC.map((p) => (
          <div key={p} className="contents">
            <div className="flex items-center pr-1 text-gray-500 dark:text-gray-400">{p}</div>
            {IMPACT_LEVELS.map((i) => {
              const n = open.filter((r) => r.probability === p && r.impact === i).length
              const active = cell?.[0] === p && cell?.[1] === i
              return (
                <button
                  key={i}
                  data-cell={`${p}-${i}`}
                  onClick={() => onCell(active ? undefined : [p, i])}
                  className={`h-9 rounded font-semibold ${scoreClass(riskScore({ probability: p, impact: i }))} ${n ? '' : 'opacity-40'} ${active ? 'ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-[#1d1d29]' : ''}`}
                >
                  {n || ''}
                </button>
              )
            })}
          </div>
        ))}
        <div />
        {IMPACT_LEVELS.map((i) => (
          <div key={i} className="text-center text-gray-500 dark:text-gray-400">
            {i}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-gray-400">
        <span>↑ {tr('risks_probability')}</span>
        <span>{tr('risks_impact')} →</span>
      </div>
    </div>
  )
}

export function RisksPage() {
  const { tr, risks, updateRisk, deleteRisk, addRisk, tasks, settings, readOnly } = useApp()
  const project = useActiveProject()
  const changes = project?.changes ?? []
  const [tab, setTab] = useState<Tab>('all')
  const [status, setStatus] = useState('')
  const [owner, setOwner] = useState('')
  const [text, setText] = useState('')
  const [cell, setCell] = useState<[ImpactLevel, ImpactLevel]>()

  // Every edit stamps "last update", like keeping the register's date current by hand.
  const edit = (id: string, patch: Partial<Risk>) => updateRisk(id, { ...patch, lastUpdate: toDateKey(new Date()) })

  const owners = useMemo(() => [...new Set(risks.map((r) => r.owner).filter(Boolean))].sort(), [risks])
  const rows = useMemo(() => {
    const q = text.trim().toLowerCase()
    return risks.filter(
      (r) =>
        (tab === 'all' || (r.type ?? 'Risk') === tab) &&
        (!status || r.status === status) &&
        (!owner || r.owner === owner) &&
        (!cell || (isScored(r) && r.probability === cell[0] && r.impact === cell[1])) &&
        (!q || `${r.id} ${r.title ?? ''} ${r.description} ${r.mitigation} ${r.resolution ?? ''} ${r.rationale ?? ''}`.toLowerCase().includes(q)),
    )
  }, [risks, tab, status, owner, cell, text])

  const add = () => {
    const type: RiskType = tab === 'all' ? 'Risk' : tab
    addRisk({
      id: nextSequentialId(
        risks.map((r) => r.id),
        'R-',
        3,
      ),
      type,
      title: '',
      area: '',
      description: '',
      probability: 'Medium',
      impact: 'Medium',
      owner: '',
      mitigation: '',
      status: 'Open',
      lastUpdate: toDateKey(new Date()),
      ...(type === 'Decision' ? { decisionDate: toDateKey(new Date()), status: 'Closed' as const } : {}),
    })
  }

  const th = 'px-2 py-2 whitespace-nowrap'
  const td = 'px-2 py-1 align-top'
  const areaOptions = (current: string) =>
    current && !settings.projectAreas.includes(current) ? [...settings.projectAreas, current] : settings.projectAreas
  const show = (...types: RiskType[]) => tab === 'all' || types.includes(tab)
  const textInput = (r: Risk, key: keyof Risk, w = 'w-48') => (
    <input value={(r[key] as string) ?? ''} onChange={(e) => edit(r.id, { [key]: e.target.value || undefined })} className={`${w} ${inputGhost}`} />
  )

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">{tr('raid_help')}</p>
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1" role="tablist">
            {(['all', ...RISK_TYPES] as Tab[]).map((t) => {
              const n = t === 'all' ? risks.length : risks.filter((r) => (r.type ?? 'Risk') === t).length
              return (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'}`}
                >
                  {t !== 'all' && `${TYPE_ICON[t]} `}
                  {tr(t === 'all' ? 'raid_all' : (`raid_${t}` as TKey))} <span className="opacity-60">{n}</span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={tr('plan_search')} className={`${selectFilter} w-44`} />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectFilter} aria-label={tr('common_status')}>
              <option value="">
                {tr('tasks_filter_all')} — {tr('common_status')}
              </option>
              {RISK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className={selectFilter}>
              <option value="">{tr('plan_all_owners')}</option>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <div className="flex-1" />
            <button onClick={add} className={btnPrimary} disabled={readOnly}>
              {tr('raid_add')} {tab !== 'all' && tr(`raid_${tab}` as TKey).toLowerCase()}
            </button>
          </div>
        </div>
        <Heatmap items={risks} cell={cell} onCell={setCell} />
      </div>

      <div className={tableWrap}>
        <table className="w-full min-w-[1400px] text-sm">
          <thead>
            <tr className={theadRow}>
              <th className={th}>ID</th>
              {tab === 'all' && <th className={th}>{tr('risks_type')}</th>}
              <th className={th}>{tr('raid_title')}</th>
              <th className={th}>{tr('risks_description')}</th>
              <th className={th}>{tr('common_project_area')}</th>
              {show('Risk', 'Issue', 'Dependency') && <th className={th}>{tr('risks_probability')}</th>}
              {show('Risk', 'Issue', 'Assumption', 'Dependency') && <th className={th}>{tr('risks_impact')}</th>}
              {show('Risk', 'Issue') && <th className={th}>P×I</th>}
              {show('Risk') && <th className={th}>{tr('raid_response')}</th>}
              {show('Risk', 'Dependency') && <th className={th}>{tr('risks_mitigation')}</th>}
              {tab === 'Risk' && <th className={th}>{tr('raid_contingency')}</th>}
              {tab === 'Risk' && <th className={th}>{tr('raid_trigger')}</th>}
              {show('Issue') && tab !== 'all' && <th className={th}>{tr('plan_priority')}</th>}
              {show('Issue') && tab !== 'all' && <th className={th}>{tr('raid_resolution')}</th>}
              {show('Assumption') && tab !== 'all' && <th className={th}>{tr('raid_validated')}</th>}
              {show('Decision') && tab !== 'all' && <th className={th}>{tr('raid_decided_by')}</th>}
              {show('Decision') && tab !== 'all' && <th className={th}>{tr('raid_decision_date')}</th>}
              {show('Decision') && tab !== 'all' && <th className={th}>{tr('raid_rationale')}</th>}
              <th className={th}>{tr('common_owner')}</th>
              <th className={th}>{tr('risks_linked_task')}</th>
              <th className={th}>{tr('risks_due_date')}</th>
              <th className={th}>{tr('common_status')}</th>
              <th className={th}>{tr('risks_last_update')}</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const type = r.type ?? 'Risk'
              const scored = isScored(r)
              const levelSelect = (k: 'probability' | 'impact') => (
                <select
                  value={r[k]}
                  onChange={(e) => edit(r.id, { [k]: e.target.value as ImpactLevel })}
                  className={`rounded px-2 py-0.5 text-xs font-medium ${IMPACT_COLOR[r[k]]}`}
                >
                  {IMPACT_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              )
              return (
                <tr key={r.id} className={tbodyRow} data-raid-id={r.id}>
                  <td className={`${td} whitespace-nowrap font-medium text-gray-500 dark:text-gray-400`}>{r.id}</td>
                  {tab === 'all' && (
                    <td className={td}>
                      <select value={type} onChange={(e) => edit(r.id, { type: e.target.value as RiskType })} className={selectGhost}>
                        {RISK_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {TYPE_ICON[t]} {t}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className={td}>{textInput(r, 'title', 'w-44 font-medium')}</td>
                  <td className={td}>{textInput(r, 'description', 'w-64')}</td>
                  <td className={td}>
                    <select value={r.area} onChange={(e) => edit(r.id, { area: e.target.value })} className={selectGhost}>
                      <option value="">—</option>
                      {areaOptions(r.area).map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </td>
                  {show('Risk', 'Issue', 'Dependency') && <td className={td}>{type === 'Assumption' || type === 'Decision' ? null : levelSelect('probability')}</td>}
                  {show('Risk', 'Issue', 'Assumption', 'Dependency') && <td className={td}>{type === 'Decision' ? null : levelSelect('impact')}</td>}
                  {show('Risk', 'Issue') && (
                    <td className={td}>
                      {scored && <span className={`inline-block min-w-[2rem] rounded px-2 py-0.5 text-center text-xs font-semibold ${scoreClass(riskScore(r))}`}>{riskScore(r)}</span>}
                    </td>
                  )}
                  {show('Risk') && (
                    <td className={td}>
                      {type === 'Risk' && (
                        <select value={r.response ?? ''} onChange={(e) => edit(r.id, { response: (e.target.value || undefined) as Risk['response'] })} className={selectGhost}>
                          <option value="">—</option>
                          {RISK_RESPONSES.map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  )}
                  {show('Risk', 'Dependency') && (
                    <td className={td}>
                      {type === 'Risk' || type === 'Dependency'
                        ? textInput(r, 'mitigation')
                        : type === 'Issue'
                          ? textInput(r, 'resolution')
                          : type === 'Decision'
                            ? textInput(r, 'rationale')
                            : null}
                    </td>
                  )}
                  {tab === 'Risk' && <td className={td}>{textInput(r, 'contingency')}</td>}
                  {tab === 'Risk' && <td className={td}>{textInput(r, 'trigger', 'w-40')}</td>}
                  {show('Issue') && tab !== 'all' && (
                    <td className={td}>
                      <select value={r.priority ?? ''} onChange={(e) => edit(r.id, { priority: e.target.value || undefined })} className={selectGhost}>
                        <option value="">—</option>
                        {settings.priorities.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  {show('Issue') && tab !== 'all' && <td className={td}>{textInput(r, 'resolution', 'w-56')}</td>}
                  {show('Assumption') && tab !== 'all' && (
                    <td className={`${td} text-center`}>
                      <input type="checkbox" checked={Boolean(r.validated)} onChange={(e) => edit(r.id, { validated: e.target.checked })} />
                    </td>
                  )}
                  {show('Decision') && tab !== 'all' && <td className={td}>{textInput(r, 'decidedBy', 'w-32')}</td>}
                  {show('Decision') && tab !== 'all' && (
                    <td className={td}>
                      <input type="date" value={r.decisionDate ?? ''} onChange={(e) => edit(r.id, { decisionDate: e.target.value || undefined })} className={selectGhost} />
                    </td>
                  )}
                  {show('Decision') && tab !== 'all' && (
                    <td className={td}>
                      {textInput(r, 'rationale', 'w-56')}
                      {r.linkedChangeId && <div className="px-1 text-[11px] text-gray-400">↳ {changes.find((c) => c.id === r.linkedChangeId)?.id ?? r.linkedChangeId}</div>}
                    </td>
                  )}
                  <td className={td}>{textInput(r, 'owner', 'w-28')}</td>
                  <td className={td}>
                    <select value={r.linkedTaskId ?? ''} onChange={(e) => edit(r.id, { linkedTaskId: e.target.value || undefined })} className={`max-w-[160px] ${selectGhost}`}>
                      <option value="">—</option>
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          #{t.no} {t.name || t.id}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={td}>
                    <input type="date" value={r.dueDate ?? ''} onChange={(e) => edit(r.id, { dueDate: e.target.value || undefined })} className={selectGhost} />
                  </td>
                  <td className={td}>
                    <select value={r.status} onChange={(e) => edit(r.id, { status: e.target.value as Risk['status'] })} className={selectGhost}>
                      {RISK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`${td} whitespace-nowrap text-xs text-gray-400`}>{r.lastUpdate ?? ''}</td>
                  <td className={`${td} text-right`}>
                    <button onClick={() => deleteRisk(r.id)} className={deleteBtn} title={tr('tasks_delete')} disabled={readOnly}>
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-sm text-gray-400">{tr('raid_empty')}</p>}
      </div>
      {cell && (
        <button className={btnSecondary} onClick={() => setCell(undefined)}>
          {tr('raid_clear_filter')}
        </button>
      )}
    </div>
  )
}
