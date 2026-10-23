import { create } from 'zustand'
import { fileOpen, fileSave, supported as fsaSupported } from 'browser-fs-access'
import type { Workspace } from '../../types'
import { parseAnyFile, serializeWorkspace, type ParsedFile } from '../../domain/workspace'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { addBackup, clearFileHandle, loadFileHandle, saveCachedWorkspace, saveFileHandle } from './cache'
import { loadState } from '../storage'
import { usePrefsStore } from '../../store/prefsStore'

/*
 * Workspace file sync ("the file is the source of truth, the browser is a cache").
 *
 * Single-writer model: before every write the file's lastModified is checked
 * against the value we last saw; if someone else saved in the meantime (newer
 * revision of the same workspace, or a different workspace), we do NOT
 * overwrite - status becomes 'conflict' and the user decides.
 */

export type SyncStatus =
  | 'local-only' // no linked file; data only in this browser (+ backups)
  | 'saved'
  | 'dirty'
  | 'saving'
  | 'conflict'
  | 'read-only'
  | 'needs-permission' // handle restored after restart, browser wants a click to re-grant access
  | 'error'

interface SyncState {
  status: SyncStatus
  fileName?: string
  lastSavedAt?: string
  error?: string
  conflictWith?: Workspace
}

// Permission API of the File System Access spec (not yet in lib.dom typings).
type PermissionedHandle = FileSystemFileHandle & {
  queryPermission(d: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission(d: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
}
const perm = (h: FileSystemFileHandle) => h as PermissionedHandle

export const useSyncStore = create<SyncState>(() => ({ status: 'local-only' }))

export const fileAccessSupported = fsaSupported

const FILE_EXT = '.pmw.json'
const fileOptions = {
  extensions: ['.json'],
  mimeTypes: ['application/json'],
  description: 'PM workspace',
  id: 'pm-workspace',
}

let handle: FileSystemFileHandle | null = null
let baseModified: number | null = null
let suppressDirty = false
let autosaveTimer: ReturnType<typeof setTimeout> | undefined

const setSync = (patch: Partial<SyncState>) => useSyncStore.setState(patch)
const userName = () => usePrefsStore.getState().userName
const autosaveDelay = () => Math.max(500, usePrefsStore.getState().autosaveDelayMs)

function suggestedName(ws: Workspace): string {
  const name = ws.projects.length === 1 ? ws.projects[0].info.projectName : 'Portfolio'
  return `${name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Portfolio'}${FILE_EXT}`
}

async function readHandle(h: FileSystemFileHandle): Promise<{ parsed: ParsedFile; modified: number }> {
  const file = await h.getFile()
  return { parsed: parseAnyFile(await file.text()), modified: file.lastModified }
}

/** Write `ws` to the handle with the next revision. Does not check conflicts. */
async function writeTo(h: FileSystemFileHandle | null, ws: Workspace): Promise<FileSystemFileHandle | null> {
  const savedAt = new Date().toISOString()
  const revision = ws.revision + 1
  const toWrite: Workspace = { ...ws, revision, savedAt, savedBy: userName() || undefined }
  const blob = new Blob([serializeWorkspace(toWrite)], { type: 'application/json' })
  const result = await fileSave(blob, { ...fileOptions, fileName: suggestedName(ws) }, h, Boolean(h))
  suppressDirty = true
  useWorkspaceStore.getState().markSaved(revision, savedAt, toWrite.savedBy)
  suppressDirty = false
  if (result) baseModified = (await result.getFile()).lastModified
  return result
}

async function persistCache(dirty: boolean) {
  await saveCachedWorkspace({ workspace: useWorkspaceStore.getState().workspace, dirty })
}

/** Save now (autosave or explicit). Detects foreign changes first. */
export async function saveNow(): Promise<void> {
  const { status } = useSyncStore.getState()
  if (!handle || status === 'read-only' || status === 'conflict' || status === 'needs-permission') return
  const ws = useWorkspaceStore.getState().workspace
  setSync({ status: 'saving', error: undefined })
  try {
    const file = await handle.getFile()
    if (baseModified !== null && file.lastModified !== baseModified) {
      const other = parseAnyFile(await file.text())
      const foreign =
        other.kind !== 'workspace' || other.workspace.id !== ws.id || other.workspace.revision > ws.revision
      if (foreign) {
        setSync({ status: 'conflict', conflictWith: other.kind === 'workspace' ? other.workspace : undefined })
        return
      }
    }
    await writeTo(handle, ws)
    await persistCache(false)
    setSync({ status: 'saved', lastSavedAt: new Date().toISOString() })
  } catch (e) {
    setSync({ status: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => void saveNow(), autosaveDelay())
}

/** Create a new workspace file (Save as) and keep saving into it. */
export async function linkNewFile(): Promise<void> {
  try {
    const h = await writeTo(null, useWorkspaceStore.getState().workspace)
    if (!h) {
      // Legacy browser: the file was downloaded; nothing to keep in sync with.
      setSync({ status: 'local-only', lastSavedAt: new Date().toISOString() })
      await persistCache(false)
      return
    }
    handle = h
    await saveFileHandle(h)
    useWorkspaceStore.getState().setReadOnly(false)
    await persistCache(false)
    setSync({ status: 'saved', fileName: h.name, lastSavedAt: new Date().toISOString(), conflictWith: undefined })
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return
    setSync({ status: 'error', error: String(e) })
  }
}

export type OpenResult =
  | { kind: 'workspace' }
  | { kind: 'legacy-project'; parsed: Extract<ParsedFile, { kind: 'legacy-project' }> }
  | { kind: 'cancelled' }

/**
 * Open a workspace file. readOnly=true opens a colleague's file for viewing:
 * no writes, edits blocked in the store. Legacy single-project files are
 * returned to the caller to be added as a project into the current workspace.
 */
export async function openFile(readOnly: boolean): Promise<OpenResult> {
  let file
  try {
    file = await fileOpen(fileOptions)
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return { kind: 'cancelled' }
    throw e
  }
  const parsed = parseAnyFile(await file.text())
  if (parsed.kind === 'legacy-project') return { kind: 'legacy-project', parsed }

  const store = useWorkspaceStore.getState()
  await addBackup(store.workspace, 'Před otevřením jiného souboru', true)
  suppressDirty = true
  store.setReadOnly(false)
  store.replaceWorkspace(parsed.workspace, loadState<string>('activeProjectId', ''))
  store.setReadOnly(readOnly)
  suppressDirty = false

  handle = file.handle ?? null
  baseModified = file.lastModified
  if (handle && !readOnly) await saveFileHandle(handle)
  else await clearFileHandle()
  await persistCache(false)
  setSync({
    status: readOnly ? 'read-only' : handle ? 'saved' : 'local-only',
    fileName: file.name,
    lastSavedAt: parsed.workspace.savedAt,
    conflictWith: undefined,
    error: undefined,
  })
  return { kind: 'workspace' }
}

/** Download a copy (always works, also without File System Access). */
export async function downloadCopy(): Promise<void> {
  const ws = useWorkspaceStore.getState().workspace
  const blob = new Blob([serializeWorkspace(ws)], { type: 'application/json' })
  await fileSave(blob, { ...fileOptions, fileName: suggestedName(ws) })
}

export async function unlinkFile(): Promise<void> {
  handle = null
  baseModified = null
  await clearFileHandle()
  useWorkspaceStore.getState().setReadOnly(false)
  setSync({ status: 'local-only', fileName: undefined, conflictWith: undefined })
}

/** After a browser restart the stored handle needs a user click to regain write access. */
export async function reconnect(): Promise<void> {
  if (!handle) return
  const state = await perm(handle).requestPermission({ mode: 'readwrite' })
  if (state !== 'granted') return
  await reconcileWithFile()
}

/** Conflict resolution: take the version from the file (ours goes to backups first). */
export async function resolveTakeFile(): Promise<void> {
  if (!handle) return
  const store = useWorkspaceStore.getState()
  await addBackup(store.workspace, 'Moje verze před načtením souboru (konflikt)', true)
  const { parsed, modified } = await readHandle(handle)
  if (parsed.kind !== 'workspace') return
  suppressDirty = true
  store.replaceWorkspace(parsed.workspace, store.activeProjectId)
  suppressDirty = false
  baseModified = modified
  await persistCache(false)
  setSync({ status: 'saved', conflictWith: undefined, lastSavedAt: parsed.workspace.savedAt })
}

/** Conflict resolution: keep our version but in a new file. */
export async function resolveSaveAsCopy(): Promise<void> {
  await linkNewFile()
}

/** Conflict resolution: overwrite the file anyway (explicit user decision). */
export async function resolveOverwrite(): Promise<void> {
  if (!handle) return
  const other = useSyncStore.getState().conflictWith
  const ws = useWorkspaceStore.getState().workspace
  // Continue the revision sequence of the file we are overwriting.
  if (other && other.revision > ws.revision) {
    suppressDirty = true
    useWorkspaceStore.getState().markSaved(other.revision, ws.savedAt ?? '', ws.savedBy)
    suppressDirty = false
  }
  baseModified = null
  setSync({ status: 'dirty', conflictWith: undefined })
  await saveNow()
}

/** Re-read a read-only file (colleague may have saved meanwhile). */
export async function reloadReadOnly(): Promise<void> {
  if (!handle) return
  const { parsed, modified } = await readHandle(handle)
  if (parsed.kind !== 'workspace') return
  const store = useWorkspaceStore.getState()
  suppressDirty = true
  store.setReadOnly(false)
  store.replaceWorkspace(parsed.workspace, store.activeProjectId)
  store.setReadOnly(true)
  suppressDirty = false
  baseModified = modified
  setSync({ lastSavedAt: parsed.workspace.savedAt })
}

// Compare the cached workspace with the linked file after start/reconnect.
async function reconcileWithFile(cacheDirty = useSyncStore.getState().status === 'dirty') {
  if (!handle) return
  const { parsed, modified } = await readHandle(handle)
  const store = useWorkspaceStore.getState()
  const ws = store.workspace
  if (parsed.kind !== 'workspace') {
    setSync({ status: 'error', error: 'Propojený soubor neobsahuje pracovní prostor.' })
    return
  }
  const other = parsed.workspace
  if (other.id === ws.id && other.revision <= ws.revision) {
    baseModified = modified
    setSync({ status: cacheDirty ? 'dirty' : 'saved', fileName: handle.name, lastSavedAt: other.savedAt })
    if (cacheDirty) scheduleAutosave()
    return
  }
  if (!cacheDirty && other.id === ws.id) {
    // Someone (we, on another PC) saved a newer version and we have no local edits: just load it.
    suppressDirty = true
    store.replaceWorkspace(other, store.activeProjectId)
    suppressDirty = false
    baseModified = modified
    await persistCache(false)
    setSync({ status: 'saved', fileName: handle.name, lastSavedAt: other.savedAt })
    return
  }
  baseModified = modified
  setSync({ status: 'conflict', fileName: handle.name, conflictWith: other })
}

/** Called once at startup after the workspace has been loaded from cache. */
export async function initFileSync(cacheDirty: boolean): Promise<void> {
  // Track edits: mark dirty, keep the browser cache current, autosave to the file.
  useWorkspaceStore.subscribe((state, prev) => {
    if (state.workspace === prev.workspace || suppressDirty) return
    void persistCache(true)
    void addBackup(state.workspace, 'Průběžná záloha')
    const { status } = useSyncStore.getState()
    if (status === 'read-only' || status === 'conflict' || status === 'needs-permission') return
    if (handle) {
      setSync({ status: 'dirty' })
      scheduleAutosave()
    } else {
      setSync({ status: 'local-only' })
    }
  })

  handle = (await loadFileHandle()) ?? null
  if (!handle) {
    setSync({ status: 'local-only' })
    return
  }
  setSync({ fileName: handle.name, status: cacheDirty ? 'dirty' : 'saved' })
  try {
    const state = await perm(handle).queryPermission({ mode: 'readwrite' })
    if (state !== 'granted') {
      setSync({ status: 'needs-permission' })
      return
    }
    await reconcileWithFile(cacheDirty)
  } catch (e) {
    setSync({ status: 'error', error: `Propojený soubor nelze přečíst (${e instanceof Error ? e.message : e}).` })
  }
}

/** Unsaved = edits that are only in the browser (no file, or not yet written). */
export function hasUnsavedWork(): boolean {
  const { status } = useSyncStore.getState()
  return status === 'dirty' || status === 'saving' || status === 'conflict' || status === 'error'
}
