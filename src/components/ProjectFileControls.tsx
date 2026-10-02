import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useApp } from '../context/AppContext'
import { readProjectFile, ProjectFileError } from '../lib/projectFile'

function useTick(intervalMs: number) {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceUpdate((n) => n + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}

function ExportStatusBadge() {
  const { tr, hasUnsavedChanges, lastExportedAt } = useApp()
  useTick(30_000) // keep the "X min ago" text fresh without user interaction

  let label: string
  let colorClass: string

  if (!lastExportedAt) {
    label = tr('project_never_exported')
    colorClass = hasUnsavedChanges ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'
  } else {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(lastExportedAt).getTime()) / 60_000))
    if (minutes < 1) {
      label = tr('project_exported_just_now')
    } else if (minutes < 60) {
      label = tr('project_exported_minutes_ago').replace('{n}', String(minutes))
    } else {
      label = tr('project_exported_hours_ago').replace('{n}', String(Math.round(minutes / 60)))
    }
    colorClass = !hasUnsavedChanges
      ? 'text-gray-400 dark:text-gray-500'
      : minutes >= 60
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-amber-600 dark:text-amber-400'
  }

  return (
    <span
      className={`hidden items-center gap-1.5 text-xs font-medium lg:flex ${colorClass}`}
      title={hasUnsavedChanges ? tr('project_unsaved_changes') : undefined}
    >
      {hasUnsavedChanges && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {label}
    </span>
  )
}

export function ProjectFileControls() {
  const { tr, exportProject, importProject } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleImportClick = () => {
    setError(null)
    setSuccess(false)
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file next time
    if (!file) return

    if (!window.confirm(tr('project_import_confirm'))) return

    try {
      const bundle = await readProjectFile(file)
      importProject(bundle)
      setError(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      const message = err instanceof ProjectFileError ? err.message : String(err)
      setError(tr('project_import_error') + message)
    }
  }

  return (
    <div className="relative flex items-center gap-2.5">
      <ExportStatusBadge />
      <div className="flex items-center gap-1.5">
        <button
          onClick={exportProject}
          title={tr('project_export')}
          className="flex h-8 items-center gap-1.5 rounded-md border border-gray-300 px-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10"
        >
          <span aria-hidden>⬇️</span>
          <span className="hidden sm:inline">{tr('project_export')}</span>
        </button>
        <button
          onClick={handleImportClick}
          title={tr('project_import')}
          className="flex h-8 items-center gap-1.5 rounded-md border border-gray-300 px-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10"
        >
          <span aria-hidden>⬆️</span>
          <span className="hidden sm:inline">{tr('project_import')}</span>
        </button>
        <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFileSelected} />
      </div>
      {error && (
        <span className="absolute right-0 top-10 z-30 max-w-xs rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-lg dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </span>
      )}
      {success && (
        <span className="absolute right-0 top-10 z-30 max-w-xs rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 shadow-lg dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {tr('project_import_success')}
        </span>
      )}
    </div>
  )
}
