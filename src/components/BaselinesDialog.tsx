import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useActiveProject, useWorkspaceStore } from '../store/workspaceStore'
import { btnPrimary, btnSecondary, inputGhost } from '../lib/ui'
import { formatDate } from '../lib/format'

export function BaselinesDialog({ onClose }: { onClose: () => void }) {
  const { tr, readOnly } = useApp()
  const project = useActiveProject()
  const store = useWorkspaceStore.getState()
  const baselines = project?.baselines ?? []
  const [name, setName] = useState(`Baseline ${baselines.length + 1}`)
  const [primary, setPrimary] = useState(true)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Tasks finishing later than the primary baseline (the one stored on the tasks).
  const late = (project?.tasks ?? []).filter((t) => t.baselineFinish && t.currentFinish && t.currentFinish > t.baselineFinish)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr('baseline_title')}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1d1d29]"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">📏 {tr('baseline_title')}</h2>
          <button onClick={onClose} aria-label={tr('help_close')} className="h-8 w-8 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10">
            ✕
          </button>
        </div>
        <div className="space-y-4 px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
          <p className="text-xs text-gray-500 dark:text-gray-400">{tr('baseline_help')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label={tr('baseline_name')}
              className="flex-1 rounded-md border border-gray-300 px-2 py-1 dark:border-white/15 dark:bg-[#14141c]"
            />
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} />
              {tr('baseline_primary')}
            </label>
            <button
              className={btnPrimary}
              disabled={readOnly || !name.trim()}
              onClick={() => {
                store.saveBaseline(name.trim(), primary)
                setName(`Baseline ${baselines.length + 2}`)
              }}
            >
              {tr('baseline_save')}
            </button>
          </div>
          {baselines.length === 0 ? (
            <p className="text-gray-400">{tr('baseline_empty')}</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {baselines.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span>
                    <span className="font-medium">{b.name}</span>{' '}
                    <span className="text-xs text-gray-400">{new Date(b.createdAt).toLocaleString()}</span>
                  </span>
                  <span className="flex gap-1">
                    <button className={btnSecondary} disabled={readOnly} onClick={() => store.setPrimaryBaseline(b.id)}>
                      {tr('baseline_primary')}
                    </button>
                    <button className={`${btnSecondary} ${inputGhost}`} disabled={readOnly} onClick={() => store.deleteBaseline(b.id)} aria-label={tr('tasks_delete')}>
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {late.length > 0 && (
            <div>
              <h3 className="mb-1 font-semibold">
                {tr('baseline_delayed')} ({late.length})
              </h3>
              <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs">
                {late.map((t) => (
                  <li key={t.id} className="flex justify-between gap-2">
                    <span>
                      #{t.no} {t.name}
                    </span>
                    <span className="whitespace-nowrap text-rose-600">
                      {formatDate(t.baselineFinish)} → {formatDate(t.currentFinish)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
