import { createStore, del, get, set } from 'idb-keyval'
import type { Workspace } from '../../types'
import { PREFIX } from '../storage'
import { usePrefsStore } from '../../store/prefsStore'

// IndexedDB is shared by every file:// page (like localStorage), so the DB
// name carries the same per-file-path prefix to keep app copies isolated.
const db = createStore(`${PREFIX}db`, 'kv')

export interface CachedWorkspace {
  workspace: Workspace
  // true = changes not yet written to the linked workspace file
  dirty: boolean
}

export interface Backup {
  at: string
  label: string
  workspace: Workspace
}

const BACKUP_INTERVAL_MS = 10 * 60_000

export const loadCachedWorkspace = () => get<CachedWorkspace>('workspace', db)
export const saveCachedWorkspace = (value: CachedWorkspace) => set('workspace', value, db)

export const loadFileHandle = () => get<FileSystemFileHandle>('fileHandle', db)
export const saveFileHandle = (h: FileSystemFileHandle) => set('fileHandle', h, db)
export const clearFileHandle = () => del('fileHandle', db)

export async function listBackups(): Promise<Backup[]> {
  return (await get<Backup[]>('backups', db)) ?? []
}

/**
 * Keep a rolling set of snapshots inside the browser, independent of the
 * workspace file: protects against a bad import, an accidental overwrite or a
 * file that got deleted on the share. `force` skips the interval check (used
 * right before destructive operations).
 */
export async function addBackup(workspace: Workspace, label: string, force = false): Promise<void> {
  const backups = await listBackups()
  const last = backups[0]
  if (!force && last && Date.now() - new Date(last.at).getTime() < BACKUP_INTERVAL_MS) return
  const next = [{ at: new Date().toISOString(), label, workspace }, ...backups].slice(0, Math.max(1, usePrefsStore.getState().maxBackups))
  await set('backups', next, db)
}
