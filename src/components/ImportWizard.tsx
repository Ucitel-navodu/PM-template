import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useActiveProject, useWorkspaceStore } from '../store/workspaceStore'
import { createBlankProject } from '../domain/workspace'
import { decodeText } from '../lib/import/csv'
import { ImportError, parseMspXml, type MspProject } from '../lib/import/msp'
import { fromMsp, planTaskImport, type PlanOptions, type RemovedChoice } from '../lib/import/plan'
import { planTables, readTableFile, type FilePlan, type TableInput } from '../lib/import/workbook'
import { btnPrimary, btnSecondary } from '../lib/ui'
import type { ImportSource } from '../lib/import/plan'

type Loaded = { source: 'msp'; fileName: string; msp: MspProject } | { source: 'excel' | 'csv'; fileName: string; inputs: TableInput[] }

const MAX_LIST = 40

/** Import wizard: choose a file -> review the changes -> confirm (one undo step). */
export function ImportWizard({ onClose }: { onClose: () => void }) {
  const { tr, readOnly } = useApp()
  const project = useActiveProject()!
  const store = useWorkspaceStore.getState()
  const [loaded, setLoaded] = useState<Loaded>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState<'current' | 'new'>('current')
  const [opts, setOpts] = useState<PlanOptions>({ baseline: true, autoSchedule: false })
  const [removed, setRemoved] = useState<RemovedChoice>('keep')
  const [done, setDone] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const onFile = async (file?: File) => {
    if (!file) return
    setError('')
    setLoaded(undefined)
    setDone(false)
    setBusy(true)
    try {
      const name = file.name
      if (/\.mpp$/i.test(name)) throw new ImportError(tr('import_mpp'))
      if (/\.xls$/i.test(name)) throw new ImportError(tr('import_xls'))
      const data = await file.arrayBuffer()
      if (/\.xml$/i.test(name)) setLoaded({ source: 'msp', fileName: name, msp: parseMspXml(decodeText(data)) })
      else if (/\.(xlsx|csv|txt)$/i.test(name)) {
        const { source, inputs } = await readTableFile(name, data, decodeText)
        setLoaded({ source: source as 'excel' | 'csv', fileName: name, inputs })
      } else throw new ImportError(tr('import_unknown'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // The target project decides what is "added" and what is "changed".
  const base = target === 'new' ? project.lists && createBlankProject('', project.lists) : project
  const plan: FilePlan | undefined = useMemo(() => {
    if (!loaded) return undefined
    if (loaded.source === 'msp') {
      const tasks = planTaskImport(base, fromMsp(loaded.msp), { source: 'msp', fileName: loaded.fileName, matchedBy: 'uid', warnings: loaded.msp.warnings }, opts)
      return { source: 'msp', fileName: loaded.fileName, tasks, warnings: [], unmapped: [] } as FilePlan
    }
    return planTables(base, loaded.inputs, loaded.source, loaded.fileName, opts)
  }, [loaded, base, opts])

  const t = plan?.tasks
  const total =
    (t ? t.added.length + t.updated.length + (removed === 'keep' ? 0 : t.removed.length) : 0) +
    [plan?.milestones, plan?.budget, plan?.risks].reduce((n, x) => n + (x ? x.added.length + x.updated.length : 0), 0)

  const apply = () => {
    if (!plan) return
    if (target === 'new') {
      const name = loaded?.source === 'msp' ? loaded.msp.name : undefined
      store.addProject(createBlankProject(name || loaded!.fileName.replace(/\.[^.]+$/, ''), project.lists))
    }
    store.importPlan(plan, removed)
    setDone(true)
  }

  const warnings = [...(plan?.warnings ?? []), ...(t?.warnings ?? []), ...[plan?.milestones, plan?.budget, plan?.risks].flatMap((x) => x?.warnings ?? [])]
  const list = <T,>(items: T[], render: (x: T) => React.ReactNode) => (
    <ul className="space-y-0.5 text-xs">
      {items.slice(0, MAX_LIST).map(render)}
      {items.length > MAX_LIST && <li className="text-gray-400">{tr('import_more').replace('{n}', String(items.length - MAX_LIST))}</li>}
    </ul>
  )
  const badge = (n: number, cls: string) => <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${cls}`}>{n}</span>

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr('import_title')}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1d1d29]"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">📥 {tr('import_title')}</h2>
          <button onClick={onClose} aria-label={tr('help_close')} className="h-8 w-8 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10">
            ✕
          </button>
        </div>

        <div className="max-h-[75vh] space-y-4 overflow-y-auto px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
          {readOnly && <p className="rounded-md bg-amber-50 p-2 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{tr('import_readonly')}</p>}
          <p>{tr('import_intro')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button className={btnSecondary} onClick={() => input.current?.click()} disabled={readOnly}>
              {tr('import_choose')}
            </button>
            <input ref={input} data-testid="import-file" type="file" accept=".xml,.xlsx,.csv,.txt,.mpp,.xls" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            {loaded && <span className="text-xs text-gray-500">{loaded.fileName}</span>}
            {busy && <span className="text-xs text-gray-500">{tr('import_reading')}</span>}
          </div>

          {error && (
            <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </div>
          )}

          {plan && (
            <div className="space-y-4" data-testid="import-review">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2">
                  {tr('import_target')}
                  <select value={target} onChange={(e) => setTarget(e.target.value as 'current' | 'new')} className="rounded-md border border-gray-300 px-2 py-1 dark:border-white/15 dark:bg-[#14141c]">
                    <option value="current">{tr('import_target_current')}</option>
                    <option value="new">{tr('import_target_new')}</option>
                  </select>
                </label>
                {plan.source === 'msp' && (
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={opts.baseline} onChange={(e) => setOpts({ ...opts, baseline: e.target.checked })} />
                    {tr('import_baseline')}
                  </label>
                )}
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={opts.autoSchedule} onChange={(e) => setOpts({ ...opts, autoSchedule: e.target.checked })} />
                  {tr('import_auto')}
                </label>
              </div>
              {plan.source === 'msp' && <p className="text-xs text-gray-500">{tr('import_policy')}</p>}

              {warnings.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <b>{tr('import_warnings')}</b>
                  <ul className="mt-1 list-disc pl-4">{warnings.slice(0, 12).map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}
              {plan.unmapped.map((u) => (
                <p key={u.sheet} className="text-xs text-gray-500">
                  {tr('import_unmapped')} · {u.sheet}: {u.columns.join(', ')}
                </p>
              ))}

              {t && (
                <section className="space-y-2">
                  <h3 className="flex flex-wrap items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
                    {tr('nav_tasks')} {badge(t.added.length, 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20')} {tr('import_added')} {badge(t.updated.length, 'bg-sky-100 text-sky-700 dark:bg-sky-500/20')} {tr('import_changed')}{' '}
                    {badge(t.unchanged.length, 'bg-gray-100 text-gray-600 dark:bg-white/10')} {tr('import_unchanged')}
                    {t.removed.length > 0 && <>{badge(t.removed.length, 'bg-rose-100 text-rose-700 dark:bg-rose-500/20')} {tr('import_removed')}</>}
                  </h3>
                  {t.added.length > 0 && list(t.added, (x) => <li key={x.id}>＋ #{x.no} {x.name}</li>)}
                  {t.updated.length > 0 &&
                    list(t.updated, (u) => (
                      <li key={u.task.id}>
                        <b>
                          #{u.task.no} {u.task.name}
                        </b>
                        {u.changes.map((c) => (
                          <span key={c.field} className="ml-2 text-gray-500">
                            {c.field}: <s>{c.old || '∅'}</s> → <b>{c.new || '∅'}</b>
                          </span>
                        ))}
                      </li>
                    ))}
                  {t.removed.length > 0 && (
                    <div className="rounded-md bg-rose-50 p-2 dark:bg-rose-500/10">
                      <p className="mb-1 text-xs">{tr('import_removed_help')}</p>
                      {list(t.removed, (x) => <li key={x.id}>− #{x.no} {x.name}</li>)}
                      <div className="mt-2 flex gap-4 text-xs">
                        {(['keep', 'cancel', 'delete'] as RemovedChoice[]).map((c) => (
                          <label key={c} className="flex items-center gap-1">
                            <input type="radio" name="removed" checked={removed === c} onChange={() => setRemoved(c)} />
                            {tr(c === 'keep' ? 'import_keep' : c === 'cancel' ? 'import_cancel_tasks' : 'import_delete')}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
              {(
                [
                  ['import_milestones', plan.milestones, (x: { id: string; name?: string }) => x.name],
                  ['import_budget', plan.budget, (x: { id: string; description?: string; supplier?: string }) => x.description || x.supplier],
                  ['import_risks', plan.risks, (x: { id: string; title?: string; description?: string }) => x.title || x.description],
                ] as const
              ).map(([key, tbl, label]) =>
                tbl ? (
                  <section key={key} className="space-y-1">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
                      {tr(key)} {badge(tbl.added.length, 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20')} {tr('import_added')} {badge(tbl.updated.length, 'bg-sky-100 text-sky-700 dark:bg-sky-500/20')} {tr('import_changed')}
                    </h3>
                    {list(tbl.added as { id: string }[], (x) => <li key={x.id}>＋ {x.id} {label(x as never)}</li>)}
                    {list(tbl.updated.map((u) => u.item) as { id: string }[], (x) => <li key={x.id}>~ {x.id} {label(x as never)}</li>)}
                  </section>
                ) : null,
              )}
              {total === 0 && <p className="text-gray-500">{tr('import_nothing')}</p>}
            </div>
          )}
          {done && (
            <p role="status" className="font-medium text-emerald-600 dark:text-emerald-400">
              {tr('import_done')}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-white/10">
          <button className={btnSecondary} onClick={onClose}>
            {done ? tr('help_close') : tr('common_cancel')}
          </button>
          {!done && (
            <button className={btnPrimary} onClick={apply} disabled={!plan || total === 0 || readOnly}>
              {tr('import_apply')} {plan && total > 0 ? `(${total})` : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export type { ImportSource }
