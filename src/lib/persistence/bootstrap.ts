import { createSampleWorkspace, workspaceFromLegacySnapshot } from '../../domain/workspace'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { loadState, saveState } from '../storage'
import { addBackup, loadCachedWorkspace, saveCachedWorkspace } from './cache'
import { initFileSync } from './fileSync'

const LEGACY_KEYS = ['projectInfo', 'tasks', 'milestones', 'budget', 'risks', 'settings', 'absences'] as const

/** Data written by the single-project version of the app (separate localStorage keys). */
function readLegacyLocalStorage() {
  if (loadState<unknown>('projectInfo', null) === null) return null
  return Object.fromEntries(LEGACY_KEYS.map((k) => [k, loadState<unknown>(k, undefined)]))
}

/**
 * Startup order: browser cache (IndexedDB) -> migrate data of the previous
 * single-project version (localStorage, left untouched as a fallback) ->
 * sample workspace on a truly first run. Then connect the workspace file.
 */
export async function bootstrapWorkspace(): Promise<void> {
  const store = useWorkspaceStore.getState()
  const activeId = loadState<string>('activeProjectId', '')

  let cacheDirty = false
  const cached = await loadCachedWorkspace().catch(() => undefined)
  if (cached?.workspace?.projects?.length) {
    store.replaceWorkspace(cached.workspace, activeId)
    cacheDirty = cached.dirty
  } else {
    const legacy = readLegacyLocalStorage()
    const ws = legacy ? workspaceFromLegacySnapshot(legacy) : createSampleWorkspace()
    store.replaceWorkspace(ws, activeId)
    await saveCachedWorkspace({ workspace: ws, dirty: Boolean(legacy) })
    if (legacy) await addBackup(ws, 'Převedeno z předchozí verze aplikace', true)
    cacheDirty = Boolean(legacy)
  }

  useWorkspaceStore.subscribe((s, prev) => {
    if (s.activeProjectId !== prev.activeProjectId) saveState('activeProjectId', s.activeProjectId)
  })
  saveState('activeProjectId', useWorkspaceStore.getState().activeProjectId)

  await initFileSync(cacheDirty)
}
