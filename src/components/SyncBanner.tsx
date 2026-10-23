import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useWorkspaceStore } from '../store/workspaceStore'
import {
  downloadCopy,
  fileAccessSupported,
  linkNewFile,
  reconnect,
  reloadReadOnly,
  resolveOverwrite,
  resolveSaveAsCopy,
  resolveTakeFile,
  saveNow,
  unlinkFile,
  useSyncStore,
} from '../lib/persistence/fileSync'

const btn =
  'whitespace-nowrap rounded-md border border-current/30 bg-white/60 px-2.5 py-1 text-xs font-semibold hover:bg-white dark:bg-white/10 dark:hover:bg-white/20'

/** Actionable states of the workspace file, shown under the header. */
export function SyncBanner() {
  const { tr } = useApp()
  const { status, fileName = '', error } = useSyncStore()
  const [dismissedLocal, setDismissedLocal] = useState(false)
  const fill = (key: Parameters<typeof tr>[0]) => tr(key).replace('{name}', fileName).replace('{error}', error ?? '')

  const wrap = (tone: string, children: React.ReactNode) => (
    <div className={`border-b px-4 py-2 text-sm sm:px-6 ${tone}`} role="status">
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-center gap-x-4 gap-y-2">{children}</div>
    </div>
  )
  const amber = 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
  const rose = 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
  const sky = 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200'

  switch (status) {
    case 'local-only':
      if (dismissedLocal) return null
      return wrap(
        amber,
        <>
          <span className="flex-1">{fileAccessSupported ? tr('banner_local_only') : tr('banner_local_only_fallback')}</span>
          {fileAccessSupported ? (
            <button className={btn} onClick={() => void linkNewFile()}>
              💾 {tr('file_link_new')}
            </button>
          ) : (
            <button className={btn} onClick={() => void downloadCopy()}>
              ⬇️ {tr('file_download_copy')}
            </button>
          )}
          <button className="text-xs opacity-60 hover:opacity-100" onClick={() => setDismissedLocal(true)} aria-label="dismiss">
            ✕
          </button>
        </>,
      )
    case 'needs-permission':
      return wrap(
        amber,
        <>
          <span className="flex-1">{fill('banner_needs_permission')}</span>
          <button className={btn} onClick={() => void reconnect()}>
            {tr('banner_reconnect')}
          </button>
        </>,
      )
    case 'conflict':
      return wrap(
        rose,
        <>
          <span className="flex-1">⚠️ {fill('banner_conflict')}</span>
          <button className={btn} onClick={() => void resolveTakeFile()}>
            {tr('banner_take_file')}
          </button>
          <button className={btn} onClick={() => void resolveSaveAsCopy()}>
            {tr('banner_save_copy')}
          </button>
          <button
            className={btn}
            onClick={() => window.confirm(tr('banner_overwrite_confirm')) && void resolveOverwrite()}
          >
            {tr('banner_overwrite')}
          </button>
        </>,
      )
    case 'read-only':
      return wrap(
        sky,
        <>
          <span className="flex-1">👁️ {fill('banner_read_only')}</span>
          <button className={btn} onClick={() => void reloadReadOnly()}>
            {tr('banner_reload')}
          </button>
          <button
            className={btn}
            onClick={() => {
              void unlinkFile()
              useWorkspaceStore.getState().setReadOnly(false)
            }}
          >
            {tr('banner_edit_copy')}
          </button>
        </>,
      )
    case 'error':
      return wrap(
        rose,
        <>
          <span className="flex-1">{fill('banner_error')}</span>
          <button className={btn} onClick={() => void saveNow()}>
            {tr('banner_retry')}
          </button>
        </>,
      )
    default:
      return null
  }
}
