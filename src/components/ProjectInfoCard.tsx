import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Card, Stat } from './Card'
import { formatDate, formatMoney } from '../lib/format'
import { btnPrimary, btnSecondary } from '../lib/ui'
import type { ProjectInfo } from '../types'
import type { TKey } from '../i18n'

const field =
  'w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-white/15 dark:bg-[#14141c] dark:text-gray-100'

const FIELDS: { key: keyof ProjectInfo; label: TKey | 'BPM' | 'ITPM'; type?: 'date' | 'number'; wide?: boolean }[] = [
  { key: 'projectName', label: 'dash_project_name', wide: true },
  { key: 'projectId', label: 'dash_project_id' },
  { key: 'businessOwner', label: 'dash_business_owner' },
  { key: 'bpm', label: 'BPM' },
  { key: 'itpm', label: 'ITPM' },
  { key: 'start', label: 'dash_start', type: 'date' },
  { key: 'plannedFinish', label: 'dash_planned_finish', type: 'date' },
  { key: 'budget', label: 'dash_budget_label', type: 'number' },
  { key: 'currency', label: 'dash_currency' },
]

export function ProjectInfoCard() {
  const { tr, projectInfo, setProjectInfo } = useApp()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ProjectInfo>(projectInfo)

  const label = (l: (typeof FIELDS)[number]['label']) => (l === 'BPM' || l === 'ITPM' ? l : tr(l))

  const startEdit = () => {
    setDraft(projectInfo)
    setEditing(true)
  }

  const save = () => {
    setProjectInfo({
      ...draft,
      projectName: draft.projectName.trim() || projectInfo.projectName,
      currency: draft.currency.trim().toUpperCase() || 'CZK',
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <Card title={tr('dash_project_info')} icon="📌" accent="indigo">
        <div
          className="grid grid-cols-2 gap-x-3 gap-y-2"
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
        >
          {FIELDS.map((f) => (
            <label key={f.key} className={f.wide ? 'col-span-2' : ''}>
              <span className="text-xs text-gray-500 dark:text-gray-400">{label(f.label)}</span>
              <input
                type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                value={String(draft[f.key] ?? '')}
                autoFocus={f.key === 'projectName'}
                onChange={(e) =>
                  setDraft({ ...draft, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })
                }
                className={field}
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={() => setEditing(false)} className={btnSecondary}>
            {tr('common_cancel')}
          </button>
          <button onClick={save} className={btnPrimary}>
            {tr('common_save')}
          </button>
        </div>
      </Card>
    )
  }

  return (
    <div className="group relative">
      <Card title={tr('dash_project_info')} icon="📌" accent="indigo">
        <button
          onClick={startEdit}
          className="absolute right-3 top-3 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 hover:border-brand-500 hover:text-brand-600 dark:border-white/10 dark:text-gray-400 dark:hover:text-brand-300"
        >
          ✏️ {tr('common_edit')}
        </button>
        <div className="mb-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {tr('dash_project_name')} · {projectInfo.projectId}
          </div>
          <div className="text-xl font-semibold text-gray-900 dark:text-gray-50">{projectInfo.projectName}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label={tr('dash_business_owner')} value={projectInfo.businessOwner || '—'} />
          <Stat label="BPM" value={projectInfo.bpm || '—'} />
          <Stat label="ITPM" value={projectInfo.itpm || '—'} />
          <Stat label={tr('dash_start')} value={formatDate(projectInfo.start) || '—'} />
          <Stat label={tr('dash_planned_finish')} value={formatDate(projectInfo.plannedFinish) || '—'} />
          <Stat label={tr('dash_budget_label')} value={formatMoney(projectInfo.budget, projectInfo.currency)} />
        </div>
      </Card>
    </div>
  )
}
