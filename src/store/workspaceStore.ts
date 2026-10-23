import { create } from 'zustand'
import { temporal } from 'zundo'
import type { Absence, BudgetItem, CalendarSettings, Milestone, Project, ProjectInfo, ProjectLists, Risk, Task, Workspace } from '../types'
import { createBlankProject, newId } from '../domain/workspace'

export type ListKey = keyof ProjectLists

// Collections inside a project that share add/update/delete semantics.
type CollectionMap = { tasks: Task; milestones: Milestone; budget: BudgetItem; risks: Risk }
export type CollectionKey = keyof CollectionMap

interface WorkspaceState {
  workspace: Workspace
  activeProjectId: string
  readOnly: boolean

  setActiveProject: (id: string) => void
  setReadOnly: (readOnly: boolean) => void
  /** Load a whole workspace (open file, cache restore). Clears undo history. */
  replaceWorkspace: (ws: Workspace, activeProjectId?: string) => void
  /** Bookkeeping written by the file sync after a successful save. Not an undo step. */
  markSaved: (revision: number, savedAt: string, savedBy?: string) => void

  addProject: (project: Project) => void
  duplicateProject: (id: string) => void
  deleteProject: (id: string) => void
  setProjectArchived: (id: string, archived: boolean) => void
  updateProjectInfo: (info: ProjectInfo) => void

  addItem: <K extends CollectionKey>(coll: K, item: CollectionMap[K]) => void
  updateItem: <K extends CollectionKey>(coll: K, id: string, patch: Partial<CollectionMap[K]>) => void
  deleteItem: (coll: CollectionKey, id: string) => void

  updateLists: (patch: Partial<ProjectLists>) => void
  renameListItem: (list: ListKey, oldName: string, newName: string) => void
  updateCalendar: (patch: Partial<CalendarSettings>) => void

  addAbsence: (a: Absence) => void
  updateAbsence: (id: string, patch: Partial<Absence>) => void
  deleteAbsence: (id: string) => void
}

function touch(p: Project): Project {
  return { ...p, updatedAt: new Date().toISOString() }
}

// Leading-edge throttle: the first change of a burst (e.g. typing a name)
// records the pre-burst state as one undo step; the rest of the burst is merged.
// Reset when history is cleared, so the first edit after loading a file is always undoable.
let lastTrackedAt = 0
function leadingThrottle<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  return (...args: A) => {
    const now = Date.now()
    if (now - lastTrackedAt > ms) fn(...args)
    lastTrackedAt = now
  }
}

export const useWorkspaceStore = create<WorkspaceState>()(
  temporal(
    (set, get) => {
      // All data mutations go through here: blocked in read-only mode.
      const setWs = (fn: (ws: Workspace) => Workspace) => {
        if (get().readOnly) return
        set((s) => ({ workspace: fn(s.workspace) }))
      }
      const setProject = (fn: (p: Project) => Project) =>
        setWs((ws) => ({
          ...ws,
          projects: ws.projects.map((p) => (p.id === get().activeProjectId ? touch(fn(p)) : p)),
        }))

      return {
        workspace: { fileType: 'pm-web-workspace', schemaVersion: 3, id: '', revision: 0, calendar: { holidays: [], workingDays: [], orangeTolerance: 0.1, redTolerance: 0.25 }, absences: [], projects: [] },
        activeProjectId: '',
        readOnly: false,

        setActiveProject: (id) => set({ activeProjectId: id }),
        setReadOnly: (readOnly) => set({ readOnly }),
        replaceWorkspace: (ws, activeProjectId) => {
          const active =
            activeProjectId && ws.projects.some((p) => p.id === activeProjectId)
              ? activeProjectId
              : (ws.projects.find((p) => !p.archived) ?? ws.projects[0])?.id ?? ''
          const temporalApi = useWorkspaceStore.temporal.getState()
          temporalApi.pause()
          set({ workspace: ws, activeProjectId: active })
          temporalApi.resume()
          temporalApi.clear()
          lastTrackedAt = 0
        },
        markSaved: (revision, savedAt, savedBy) => {
          const temporalApi = useWorkspaceStore.temporal.getState()
          temporalApi.pause()
          set((s) => ({ workspace: { ...s.workspace, revision, savedAt, savedBy } }))
          temporalApi.resume()
        },

        addProject: (project) => {
          setWs((ws) => ({ ...ws, projects: [...ws.projects, project] }))
          if (!get().readOnly) set({ activeProjectId: project.id })
        },
        duplicateProject: (id) => {
          const src = get().workspace.projects.find((p) => p.id === id)
          if (!src) return
          const now = new Date().toISOString()
          const copy: Project = {
            ...structuredClone(src),
            id: newId('p'),
            info: { ...src.info, projectName: `${src.info.projectName} (kopie)` },
            createdAt: now,
            updatedAt: now,
          }
          get().addProject(copy)
        },
        deleteProject: (id) => {
          setWs((ws) => {
            const projects = ws.projects.filter((p) => p.id !== id)
            return { ...ws, projects: projects.length ? projects : [createBlankProject('Nový projekt')] }
          })
          if (get().activeProjectId === id) set({ activeProjectId: get().workspace.projects[0]?.id ?? '' })
        },
        setProjectArchived: (id, archived) =>
          setWs((ws) => ({ ...ws, projects: ws.projects.map((p) => (p.id === id ? touch({ ...p, archived }) : p)) })),
        updateProjectInfo: (info) => setProject((p) => ({ ...p, info })),

        addItem: (coll, item) => setProject((p) => ({ ...p, [coll]: [...(p[coll] as { id: string }[]), item] })),
        updateItem: (coll, id, patch) =>
          setProject((p) => ({
            ...p,
            [coll]: (p[coll] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)),
          })),
        deleteItem: (coll, id) =>
          setProject((p) => ({ ...p, [coll]: (p[coll] as { id: string }[]).filter((x) => x.id !== id) })),

        updateLists: (patch) => setProject((p) => ({ ...p, lists: { ...p.lists, ...patch } })),
        renameListItem: (list, oldName, newName) => {
          if (!newName || oldName === newName) return
          setProject((p) => {
            const lists = { ...p.lists, [list]: p.lists[list].map((x) => (x === oldName ? newName : x)) }
            if (list === 'phases') {
              return { ...p, lists, tasks: p.tasks.map((t) => (t.phase === oldName ? { ...t, phase: newName } : t)) }
            }
            if (list === 'projectAreas') {
              return {
                ...p,
                lists,
                tasks: p.tasks.map((t) => (t.projectArea === oldName ? { ...t, projectArea: newName } : t)),
                risks: p.risks.map((r) => (r.area === oldName ? { ...r, area: newName } : r)),
              }
            }
            return { ...p, lists, budget: p.budget.map((b) => (b.category === oldName ? { ...b, category: newName } : b)) }
          })
        },
        updateCalendar: (patch) => setWs((ws) => ({ ...ws, calendar: { ...ws.calendar, ...patch } })),

        addAbsence: (a) => setWs((ws) => ({ ...ws, absences: [...ws.absences, a] })),
        updateAbsence: (id, patch) =>
          setWs((ws) => ({ ...ws, absences: ws.absences.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
        deleteAbsence: (id) => setWs((ws) => ({ ...ws, absences: ws.absences.filter((a) => a.id !== id) })),
      }
    },
    {
      limit: 100,
      partialize: (s) => ({ workspace: s.workspace }),
      equality: (a, b) => a.workspace === b.workspace,
      handleSet: (handleSet) => leadingThrottle(handleSet, 800),
    },
  ),
)

// Undo/redo restores only the workspace: if it removes the active project
// (e.g. undoing "new project"), fall back to another one instead of crashing.
useWorkspaceStore.subscribe((s) => {
  const { projects } = s.workspace
  if (projects.length && !projects.some((p) => p.id === s.activeProjectId)) {
    useWorkspaceStore.setState({ activeProjectId: (projects.find((p) => !p.archived) ?? projects[0]).id })
  }
})

export function useActiveProject(): Project | undefined {
  return useWorkspaceStore((s) => s.workspace.projects.find((p) => p.id === s.activeProjectId))
}

export const undo = () => useWorkspaceStore.temporal.getState().undo()
export const redo = () => useWorkspaceStore.temporal.getState().redo()
