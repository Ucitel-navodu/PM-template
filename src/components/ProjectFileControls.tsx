import { useRef, useState, type ChangeEvent } from 'react'
import { useApp } from '../context/AppContext'
import { readProjectFile, ProjectFileError } from '../lib/projectFile'

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
      {error && (
        <span className="absolute right-4 top-14 z-30 max-w-xs rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-lg dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </span>
      )}
      {success && (
        <span className="absolute right-4 top-14 z-30 max-w-xs rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 shadow-lg dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {tr('project_import_success')}
        </span>
      )}
    </div>
  )
}
