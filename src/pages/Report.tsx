import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useActiveProject, useWorkspaceStore } from '../store/workspaceStore'
import { usePrefsStore } from '../store/prefsStore'
import { buildRoadmap, buildStatusReport, defaultPeriod } from '../lib/report'
import { downloadStatusDeck } from '../lib/pptx'
import { Roadmap, type ColorBy } from '../components/Roadmap'
import { HealthBadge } from '../components/HealthBadge'
import { formatDate, formatMoney, formatPercent } from '../lib/format'
import { riskScore, scoreClass } from '../lib/raid'
import { newId } from '../domain/workspace'
import { btnPrimary, btnSecondary, selectFilter } from '../lib/ui'
import type { TKey } from '../i18n'
import type { Health, Rag, StatusReport } from '../types'

const RAG_CLASS: Record<Rag | 'Grey', string> = {
  Green: 'bg-emerald-500 text-white',
  Amber: 'bg-amber-400 text-gray-900',
  Red: 'bg-rose-500 text-white',
  Grey: 'bg-gray-300 text-gray-800',
}

type Form = Pick<StatusReport, 'rag' | 'ragComment' | 'summary' | 'achievements' | 'nextSteps' | 'escalations'>

/** Print in light mode whatever the screen theme is. */
export function printLight() {
  const root = document.documentElement
  const dark = root.classList.contains('dark')
  root.classList.remove('dark')
  const restore = () => {
    if (dark) root.classList.add('dark')
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  window.print()
}

/** Text the PM edits on screen; printed as plain paragraphs. */
function EditableText({ value, onChange, rows = 5, label }: { value: string; onChange: (v: string) => void; rows?: number; label: string }) {
  return (
    <>
      <textarea
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-md border border-gray-200 bg-white p-2 text-sm leading-relaxed text-gray-800 print:hidden dark:border-white/10 dark:bg-[#14141c] dark:text-gray-100"
      />
      <div className="hidden whitespace-pre-wrap text-sm leading-relaxed print:block">{value || '—'}</div>
    </>
  )
}

function Section({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`break-inside-avoid rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#1d1d29] print:border-gray-300 ${className}`}>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h3>
      {children}
    </section>
  )
}

export function ReportPage() {
  const { tr, lang, readOnly } = useApp()
  const project = useActiveProject()!
  const calendar = useWorkspaceStore((s) => s.workspace.calendar)
  const reportSettings = useWorkspaceStore((s) => s.workspace.reportSettings)
  const store = useWorkspaceStore.getState()
  const [period, setPeriod] = useState(() => defaultPeriod(project))
  const [groupBy, setGroupBy] = useState<'phase' | 'area'>('phase')
  const [colorBy, setColorBy] = useState<ColorBy>('phase')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [reportId, setReportId] = useState<string>()

  const data = useMemo(() => buildStatusReport(project, calendar, { ...period, today: new Date(), lang }), [project, calendar, period, lang])
  const roadmap = useMemo(() => buildRoadmap(project, calendar, groupBy), [project, calendar, groupBy])
  const autoRag: Rag | 'Grey' = data.summary.rag
  const fill = (): Form => ({
    rag: autoRag === 'Grey' ? 'Green' : autoRag,
    ragComment: data.summary.ragReasons.join('; '),
    summary: '',
    achievements: data.texts.achievements,
    nextSteps: data.texts.nextSteps,
    escalations: data.texts.escalations,
  })
  const [form, setForm] = useState<Form>(fill)
  // A new project or period starts a new draft.
  useEffect(() => {
    setForm(fill())
    setReportId(undefined)
  }, [project.id, period.from, period.to]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))
  const history = [...project.statusReports].sort((a, b) => b.date.localeCompare(a.date))
  const previous = history.find((r) => r.date < period.to && r.id !== reportId)
  const trTk = (k: string) => tr(k as TKey)

  const save = () => {
    const id = reportId ?? newId('sr')
    store.saveStatusReport({
      id,
      date: period.to,
      periodFrom: period.from,
      periodTo: period.to,
      ragAuto: autoRag,
      createdBy: usePrefsStore.getState().userName,
      createdAt: new Date().toISOString(),
      ...form,
    })
    setReportId(id)
    setNotice(tr('report_saved'))
  }

  const open = (r: StatusReport) => {
    setPeriod({ from: r.periodFrom, to: r.periodTo })
    // after the period effect has run
    setTimeout(() => {
      setForm({ rag: r.rag, ragComment: r.ragComment, summary: r.summary, achievements: r.achievements, nextSteps: r.nextSteps, escalations: r.escalations })
      setReportId(r.id)
    })
  }

  const pptx = async () => {
    setBusy(true)
    try {
      await downloadStatusDeck({ data, report: { ...form, date: period.to }, roadmap, colorBy, settings: reportSettings, tr: trTk, lang })
    } finally {
      setBusy(false)
    }
  }

  const b = data.budget
  const cur = project.info.currency
  const td = 'px-2 py-1 border-b border-gray-100 dark:border-white/5 print:border-gray-200'

  return (
    <div className="space-y-4">
      {/* Controls (not printed) */}
      <div className="space-y-3 print:hidden">
        <p className="text-xs text-gray-500 dark:text-gray-400">{tr('report_help')}</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            {tr('report_from')}
            <input type="date" value={period.from} max={period.to} onChange={(e) => e.target.value && setPeriod((p) => ({ ...p, from: e.target.value }))} className={selectFilter} />
          </label>
          <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            {tr('report_to')}
            <input type="date" value={period.to} min={period.from} onChange={(e) => e.target.value && setPeriod((p) => ({ ...p, to: e.target.value }))} className={selectFilter} />
          </label>
          <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            {tr('report_roadmap_group')}
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'phase' | 'area')} className={selectFilter}>
              <option value="phase">{tr('tasks_phase')}</option>
              <option value="area">{tr('common_project_area')}</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            {tr('report_roadmap_color')}
            <select value={colorBy} onChange={(e) => setColorBy(e.target.value as ColorBy)} className={selectFilter}>
              <option value="phase">{tr('tasks_phase')}</option>
              <option value="health">Health</option>
            </select>
          </label>
          <div className="flex-1" />
          <button className={btnSecondary} onClick={() => setForm(fill())}>
            ↻ {tr('report_regenerate')}
          </button>
          <button className={btnSecondary} onClick={printLight}>
            🖨️ {tr('report_print')}
          </button>
          <button className={btnSecondary} onClick={pptx} disabled={busy}>
            {busy ? tr('report_generating') : `📊 ${tr('report_pptx')}`}
          </button>
          <button className={btnPrimary} onClick={save} disabled={readOnly}>
            💾 {tr('report_save')}
          </button>
        </div>
        {notice && (
          <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
            {notice}
          </p>
        )}
      </div>

      {/* The report document (this is what gets printed) */}
      <article className="report-doc space-y-4" data-testid="report">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#1d1d29] print:border-0 print:p-0">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">{[reportSettings.organization, tr('report_title')].filter(Boolean).join(' · ')}</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{project.info.projectName}</h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {tr('report_period')}: {formatDate(period.from)} – {formatDate(period.to)}
              {project.info.itpm && ` · ITPM ${project.info.itpm}`}
              {project.info.businessOwner && ` · Business owner ${project.info.businessOwner}`}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {reportSettings.logoDataUrl && <img src={reportSettings.logoDataUrl} alt="" className="h-12 max-w-[10rem] object-contain" />}
            <div className="text-right">
              <div className="text-xs text-gray-500">{tr('report_rag')}</div>
              <select
                value={form.rag}
                onChange={(e) => set({ rag: e.target.value as Rag })}
                className={`mt-1 rounded-md px-3 py-1.5 text-sm font-bold print:hidden ${RAG_CLASS[form.rag]}`}
                aria-label={tr('report_rag')}
              >
                {(['Green', 'Amber', 'Red'] as Rag[]).map((r) => (
                  <option key={r} value={r}>
                    {tr(`report_rag_${r}` as TKey)}
                  </option>
                ))}
              </select>
              <span className={`mt-1 hidden rounded-md px-3 py-1.5 text-sm font-bold print:inline-block ${RAG_CLASS[form.rag]}`}>{tr(`report_rag_${form.rag}` as TKey)}</span>
              <div className="mt-1 text-[11px] text-gray-400 print:hidden">
                {tr('report_rag_auto')}: {tr(`report_rag_${autoRag}` as TKey)}
                {previous && ` · ${tr('report_trend')}: ${tr(`report_rag_${previous.rag}` as TKey)} → ${tr(`report_rag_${form.rag}` as TKey)}`}
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:grid-cols-4">
          {[
            [tr('portfolio_progress'), formatPercent(data.summary.progress), ''],
            [tr('plan_finish'), formatDate(data.finish) || '—', data.finishVariance ? `${data.finishVariance > 0 ? '+' : ''}${data.finishVariance} ${tr('report_wd_vs_baseline')}` : ''],
            [tr('report_budget_forecast'), formatMoney(b.forecast, cur), `${tr('budget_current')}: ${formatMoney(b.current, cur)}`],
            [tr('report_open_raid'), `${data.summary.openRisks} / ${data.summary.openIssues}`, `${tr('cr_open')}: ${data.changes.open.length}`],
          ].map(([label, value, sub]) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#1d1d29] print:border-gray-300">
              <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
              <div className="text-xl font-bold text-gray-900 dark:text-gray-50">{value}</div>
              {sub && <div className={`text-xs ${String(sub).startsWith('+') ? 'text-rose-600' : 'text-gray-500 dark:text-gray-400'}`}>{sub}</div>}
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
          <Section title={tr('report_summary')}>
            <EditableText label={tr('report_rag_comment')} value={form.ragComment ?? ''} onChange={(v) => set({ ragComment: v })} rows={2} />
            <div className="h-2" />
            <EditableText label={tr('report_summary')} value={form.summary} onChange={(v) => set({ summary: v })} rows={4} />
          </Section>
          <Section title={tr('report_escalations')}>
            <EditableText label={tr('report_escalations')} value={form.escalations} onChange={(v) => set({ escalations: v })} rows={7} />
          </Section>
        </div>

        <Section title={tr('report_roadmap')}>
          <p className="mb-2 text-xs text-gray-400 print:hidden">{tr('report_roadmap_help')}</p>
          <Roadmap data={roadmap} colorBy={colorBy} phases={project.lists.phases} lang={lang} />
        </Section>

        <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
          <Section title={tr('report_achievements')}>
            <EditableText label={tr('report_achievements')} value={form.achievements} onChange={(v) => set({ achievements: v })} rows={8} />
          </Section>
          <Section title={tr('report_next_steps')}>
            <EditableText label={tr('report_next_steps')} value={form.nextSteps} onChange={(v) => set({ nextSteps: v })} rows={8} />
          </Section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
          <Section title={tr('nav_milestones')}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-2 py-1">{tr('report_milestone')}</th>
                  <th className="px-2 py-1">{tr('report_planned')}</th>
                  <th className="px-2 py-1">{tr('report_baseline')}</th>
                </tr>
              </thead>
              <tbody>
                {[...data.milestones.overdue, ...data.milestones.upcoming].map((m) => (
                  <tr key={m.id}>
                    <td className={td}>{m.name}</td>
                    <td className={`${td} ${data.milestones.overdue.includes(m) ? 'font-semibold text-rose-600' : ''}`}>{formatDate(m.plannedDate)}</td>
                    <td className={td}>{formatDate(m.baselineDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section title={tr('report_health')}>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(data.health) as Health[]).map((h) => (
                <span key={h} className="flex items-center gap-1 text-sm">
                  <HealthBadge health={h} /> {data.health[h]}
                </span>
              ))}
            </div>
            {data.late.length > 0 && (
              <>
                <h4 className="mb-1 mt-3 text-xs font-semibold text-gray-500">{tr('report_late')}</h4>
                <ul className="space-y-0.5 text-sm">
                  {data.late.slice(0, 6).map(({ task, days }) => (
                    <li key={task.id}>
                      #{task.no} {task.name} <span className="text-rose-600">+{days} pd</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        </div>

        <Section title={tr('dash_risks')}>
          <table className="w-full text-sm">
            <tbody>
              {data.risks.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} w-12`}>
                    <span className={`inline-block min-w-[2rem] rounded px-1 text-center text-xs font-semibold ${scoreClass(riskScore(r))}`}>{riskScore(r)}</span>
                  </td>
                  <td className={`${td} w-16 text-gray-500`}>{r.id}</td>
                  <td className={td}>
                    <b>{r.title || r.description}</b> <span className="text-xs text-gray-500">({r.type})</span>
                  </td>
                  <td className={`${td} text-gray-600 dark:text-gray-300`}>{r.type === 'Issue' ? r.resolution : r.mitigation}</td>
                  <td className={`${td} w-32 text-gray-500`}>{r.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
          <Section title={tr('report_changes_decisions')}>
            <ul className="space-y-1 text-sm">
              {[...data.changes.open, ...data.changes.decided].map((c) => (
                <li key={c.id}>
                  <b>{c.id}</b> {c.title} · {c.status} · {c.impactDays} pd · {formatMoney(c.impactCost, cur)}
                </li>
              ))}
              {data.decisions.map((d) => (
                <li key={d.id}>
                  ⚖️ {formatDate(d.decisionDate)} {d.title || d.description} {d.decidedBy && `(${d.decidedBy})`}
                </li>
              ))}
              {data.changes.open.length + data.changes.decided.length + data.decisions.length === 0 && <li className="text-gray-400">—</li>}
            </ul>
          </Section>
          <Section title={tr('nav_budget')}>
            <table className="w-full text-sm">
              <tbody>
                {[
                  [tr('budget_approved'), b.approved],
                  [tr('budget_approved_changes'), b.changes],
                  [tr('budget_current'), b.current],
                  [tr('report_committed'), b.committed],
                  [tr('report_actual'), b.actual],
                  [tr('report_budget_forecast'), b.forecast],
                  [tr('report_variance'), b.variance],
                ].map(([label, v]) => (
                  <tr key={label as string}>
                    <td className={td}>{label}</td>
                    <td className={`${td} text-right font-medium ${label === tr('report_variance') && (v as number) < 0 ? 'text-rose-600' : ''}`}>{formatMoney(v as number, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>
        {reportSettings.footer && <footer className="text-center text-xs text-gray-400">{reportSettings.footer}</footer>}
      </article>

      {/* History (not printed) */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 print:hidden dark:border-white/10 dark:bg-[#1d1d29]">
        <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">{tr('report_history')}</h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">{tr('report_history_empty')}</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10" data-testid="report-history">
            {history.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${RAG_CLASS[r.rag]}`}>{tr(`report_rag_${r.rag}` as TKey)}</span>
                  {formatDate(r.date)} <span className="text-xs text-gray-400">{r.createdBy}</span>
                </span>
                <span className="flex gap-1">
                  <button className={btnSecondary} onClick={() => open(r)}>
                    {tr('report_open')}
                  </button>
                  <button className={btnSecondary} onClick={() => store.deleteStatusReport(r.id)} disabled={readOnly} aria-label={tr('tasks_delete')}>
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
