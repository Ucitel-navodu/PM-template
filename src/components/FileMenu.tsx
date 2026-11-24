import { createPortal } from 'react-dom'
import { ImportWizard } from './ImportWizard'
import { exportWorkbook } from '../lib/import/workbook'
import { downloadBlob } from '../lib/csv'
import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { useApp } from '../context/AppContext'
import { useWorkspaceStore, undo, redo } from '../store/workspaceStore'
import {
  downloadCopy,
  fileAccessSupported,
  linkNewFile,
  openFile,
  saveNow,
  unlinkFile,
  useSyncStore,
  type SyncStatus,
} from '../lib/persistence/fileSync'
import { addBackup, listBackups, type Backup } from '../lib/persistence/cache'
import { WorkspaceFileError } from '../domain/workspace'
import type { TKey } from '../i18n'
import { FORMATS, FORMAT_ORDER, type FileFormat } from '../lib/persistence/formats'
import { usePrefsStore } from '../store/prefsStore'
import { sensitiveHidden } from '../lib/sensitive'

const STATUS_LABEL: Record<SyncStatus, TKey> = {
  'local-only': 'sync_local_only',
  saved: 'sync_saved',
  dirty: 'sync_dirty',
  saving: 'sync_saving',
  conflict: 'sync_conflict',
  'read-only': 'sync_read_only',
  'needs-permission': 'sync_needs_permission',
  error: 'sync_error',
}

const STATUS_COLOR: Record<SyncStatus, string> = {
  'local-only': 'text-amber-600 dark:text-amber-400',
  saved: 'text-emerald-600 dark:text-emerald-400',
  dirty: 'text-gray-500 dark:text-gray-400',
  saving: 'text-gray-500 dark:text-gray-400',
  conflict: 'text-rose-600 dark:text-rose-400',
  'read-only': 'text-sky-600 dark:text-sky-400',
  'needs-permission': 'text-amber-600 dark:text-amber-400',
  error: 'text-rose-600 dark:text-rose-400',
}

const iconBtn =
  'flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10'

function isTypingTarget(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  return Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))
}

const SAVE_AS_EVENT = 'pm:save-as'
/** Open the "save to file" dialog (format choice) from anywhere. */
export const requestSaveAs = () => window.dispatchEvent(new Event(SAVE_AS_EVENT))

export function FileMenu() {
  const { tr } = useApp()
  const sync = useSyncStore()
  const canUndo = useStore(useWorkspaceStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useWorkspaceStore.temporal, (s) => s.futureStates.length > 0)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backupsOpen, setBackupsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [saveAs, setSaveAs] = useState<'link' | 'copy' | null>(null)
  const exportXlsx = async () => {
    const { workspace, activeProjectId } = useWorkspaceStore.getState()
    const project = workspace.projects.find((p) => p.id === activeProjectId)
    if (!project) return
    const bytes = await exportWorkbook(project, workspace.calendar)
    downloadBlob(`${project.info.projectName.replace(/[\\/:*?"<>|]+/g, '-')}.xlsx`, bytes as BlobPart, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  }
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  // Other places (the "data only in this browser" banner) ask for the same format dialog.
  useEffect(() => {
    const ask = () => setSaveAs('link')
    window.addEventListener(SAVE_AS_EVENT, ask)
    return () => window.removeEventListener(SAVE_AS_EVENT, ask)
  }, [])

  // Ctrl/Cmd+Z, Ctrl+Y / Ctrl+Shift+Z, Ctrl+S - outside text fields (those keep native undo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 's') {
        e.preventDefault()
        if (useSyncStore.getState().fileName) void saveNow()
        else setSaveAs('link')
        return
      }
      if (isTypingTarget(e.target)) return
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const run = async (fn: () => Promise<unknown>) => {
    setOpen(false)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof WorkspaceFileError ? e.message : e instanceof Error ? e.message : String(e))
    }
  }

  const doOpen = (readOnly: boolean) =>
    run(async () => {
      const result = await openFile(readOnly)
      if (result.kind === 'legacy-project' && window.confirm(tr('legacy_import_confirm'))) {
        const store = useWorkspaceStore.getState()
        await addBackup(store.workspace, 'Před importem projektu', true)
        store.addProject(result.parsed.project)
      }
    })

  const item =
    'block w-full whitespace-nowrap px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-200 dark:hover:bg-white/10'

  return (
    <div className="relative flex items-center gap-1.5" ref={ref}>
      <span
        className={`hidden items-center gap-1.5 whitespace-nowrap text-xs font-medium xl:flex ${STATUS_COLOR[sync.status]}`}
        title={sync.fileName ? `${sync.fileName}${sync.lastSavedAt ? ` · ${new Date(sync.lastSavedAt).toLocaleString('cs-CZ')}` : ''}` : undefined}
        data-testid="sync-status"
        data-status={sync.status}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
        {tr(STATUS_LABEL[sync.status])}
        {sync.fileName && <span className="max-w-[10rem] truncate font-normal text-gray-400">· {sync.fileName}</span>}
      </span>
      <button onClick={undo} disabled={!canUndo} className={iconBtn} title={`${tr('file_undo')} (Ctrl+Z)`} aria-label={tr('file_undo')}>
        ↶
      </button>
      <button onClick={redo} disabled={!canRedo} className={iconBtn} title={`${tr('file_redo')} (Ctrl+Y)`} aria-label={tr('file_redo')}>
        ↷
      </button>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-1 whitespace-nowrap rounded-md border border-gray-300 px-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        💾 {tr('file_menu')} ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-40 min-w-[14rem] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-[rgb(var(--pm-card))]"
        >
          <button className={item} onClick={() => run(async () => setSaveAs('link'))}>
            {tr('file_link_new')}
          </button>
          <button className={item} onClick={() => doOpen(false)}>
            {tr('file_open')}
          </button>
          <button className={item} onClick={() => doOpen(true)} disabled={!fileAccessSupported}>
            {tr('file_open_readonly')}
          </button>
          <div className="my-1 border-t border-gray-100 dark:border-white/10" />
          <button className={item} onClick={() => run(async () => setSaveAs('copy'))}>
            {tr('file_download_copy')}
          </button>
          <button className={item} onClick={() => run(async () => setImportOpen(true))}>
            {tr('import_menu')}
          </button>
          <button className={item} onClick={() => run(exportXlsx)}>
            {tr('export_xlsx')}
          </button>
          <div className="my-1 border-t border-gray-100 dark:border-white/10" />
          <button className={item} onClick={() => run(async () => setBackupsOpen(true))}>
            {tr('file_backups')}
          </button>
          <button className={item} onClick={() => run(unlinkFile)} disabled={!sync.fileName}>
            {tr('file_unlink')}
          </button>
        </div>
      )}
      {error && (
        <button
          onClick={() => setError(null)}
          className="absolute right-0 top-10 z-30 max-w-xs rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-left text-xs text-rose-700 shadow-lg dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </button>
      )}
      {/* Portals: the header's backdrop-filter would otherwise trap position:fixed dialogs inside the header box. */}
      {backupsOpen && createPortal(<BackupsDialog onClose={() => setBackupsOpen(false)} />, document.body)}
      {saveAs &&
        createPortal(
          <SaveAsDialog
            mode={saveAs}
            onClose={() => setSaveAs(null)}
            onPick={(f) => {
              const mode = saveAs
              setSaveAs(null)
              if (mode === 'copy' && sensitiveHidden() && !window.confirm(tr('sensitive_copy_confirm'))) return
              void run(() => (mode === 'link' ? linkNewFile(f) : downloadCopy(f)))
            }}
          />,
          document.body,
        )}
      {importOpen && createPortal(<ImportWizard onClose={() => setImportOpen(false)} />, document.body)}
    </div>
  )
}

function BackupsDialog({ onClose }: { onClose: () => void }) {
  const { tr } = useApp()
  const [backups, setBackups] = useState<Backup[] | null>(null)

  useEffect(() => {
    void listBackups().then(setBackups)
  }, [])

  const restore = async (b: Backup) => {
    const at = new Date(b.at).toLocaleString('cs-CZ')
    if (!window.confirm(tr('backups_restore_confirm').replace('{at}', at))) return
    const store = useWorkspaceStore.getState()
    await addBackup(store.workspace, 'Před obnovením zálohy', true)
    const wasReadOnly = store.readOnly
    store.setReadOnly(false)
    // Keep the identity/revision of the linked file so autosave continues into it.
    store.replaceWorkspace({ ...b.workspace, id: store.workspace.id, revision: store.workspace.revision }, store.activeProjectId)
    store.setReadOnly(wasReadOnly)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-16" onClick={onClose}>
      <div
        role="dialog"
        aria-label={tr('backups_title')}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[rgb(var(--pm-card))]"
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">{tr('backups_title')}</h2>
        <p className="mb-3 mt-1 text-xs text-gray-500 dark:text-gray-400">{tr('backups_help')}</p>
        {backups === null ? null : backups.length === 0 ? (
          <p className="text-sm text-gray-400">{tr('backups_empty')}</p>
        ) : (
          <ul className="max-h-[50vh] divide-y divide-gray-100 overflow-y-auto dark:divide-white/10">
            {backups.map((b) => (
              <li key={b.at} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <div className="text-gray-800 dark:text-gray-100">{new Date(b.at).toLocaleString('cs-CZ')}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {b.label} · {b.workspace.projects.length}×{' '}
                    {b.workspace.projects.map((p) => p.info.projectName).join(', ')}
                  </div>
                </div>
                <button
                  onClick={() => void restore(b)}
                  className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium hover:bg-gray-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  {tr('backups_restore')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 text-right">
          <button onClick={onClose} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            {tr('help_close')}
          </button>
        </div>
      </div>
    </div>
  )
}

const FORMAT_LABEL: Record<FileFormat, TKey> = { pmw: 'fmt_pmw', xlsx: 'fmt_xlsx', txt: 'fmt_txt', json: 'fmt_json' }

/** Format choice for a new working file / a copy (SharePoint and mail gateways often refuse .json). */
function SaveAsDialog({ mode, onClose, onPick }: { mode: 'link' | 'copy'; onClose: () => void; onPick: (f: FileFormat) => void }) {
  const { tr } = useApp()
  const [format, setFormat] = useState<FileFormat>(usePrefsStore.getState().saveFormat)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-16" onClick={onClose}>
      <div
        role="dialog"
        aria-label={tr('saveas_title')}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[rgb(var(--pm-card))]"
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">{tr(mode === 'link' ? 'file_link_new' : 'file_download_copy')}</h2>
        <p className="mb-3 mt-1 text-xs text-gray-500 dark:text-gray-400">{tr('saveas_help')}</p>
        <div role="radiogroup" aria-label={tr('saveas_title')} className="space-y-2">
          {FORMAT_ORDER.map((f) => (
            <label
              key={f}
              data-format={f}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm ${format === f ? 'border-brand-500 bg-brand-50 dark:bg-white/5' : 'border-gray-200 dark:border-white/10'}`}
            >
              <input type="radio" name="save-format" className="mt-1" checked={format === f} onChange={() => setFormat(f)} />
              <span>
                <b className="text-gray-900 dark:text-gray-50">{FORMATS[f].ext}</b>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{tr(FORMAT_LABEL[f])}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-white/15 dark:text-gray-200">
            {tr('common_cancel')}
          </button>
          <button data-testid="saveas-confirm" onClick={() => onPick(format)} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            {tr('saveas_confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
