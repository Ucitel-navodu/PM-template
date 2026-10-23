import { create } from 'zustand'
import { temporal } from 'zundo'
import type { Absence, BudgetItem, CalendarSettings, Milestone, Project, ProjectInfo, ProjectLists, Risk, Task, TaskView, Workspace } from '../types'
import { createBlankProject, migrateWorkspace, newId } from '../domain/workspace'
import { applySchedule } from '../lib/schedule/cpm'
import { WorkCalendar } from '../lib/schedule/calendar'
import { subtreeIds } from '../lib/schedule/tree'

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

  /** New task after `afterId` (same outline level) or at the end; returns its id. */
  addTask: (init?: Partial<Task>, afterId?: string) => string
  /** Edit a task the way MS Project does: moving an auto task's start sets a
   *  "start no earlier than" constraint, changing its finish changes the duration. */
  updateTask: (id: string, patch: Partial<Task>) => void
  /** Delete a task with its subtask and remove links pointing to them. */
  deleteTask: (id: string) => void
  /** Structural edits (indent/outdent/move) on the ordered task list. */
  setTasks: (fn: (tasks: Task[]) => Task[]) => void
  saveBaseline: (name: string, primary: boolean) => void
  setPrimaryBaseline: (id: string) => void
  deleteBaseline: (id: string) => void
  saveView: (view: TaskView) => void
  deleteView: (id: string) => void

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
      // Every project edit re-runs the scheduler, so dates are always consistent
      // (one undo step for the edit and its knock-on effects).
      const setProject = (fn: (p: Project) => Project) =>
        setWs((ws) => ({
          ...ws,
          projects: ws.projects.map((p) => (p.id === get().activeProjectId ? touch(applySchedule(fn(p), ws.calendar)) : p)),
        }))
      const setTaskList = (fn: (tasks: Task[]) => Task[]) => setProject((p) => ({ ...p, tasks: fn(p.tasks) }))

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
          set({ workspace: migrateWorkspace(ws), activeProjectId: active })
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

        addTask: (init = {}, afterId) => {
          const id = newId('t')
          setTaskList((tasks) => {
            const after = afterId ? tasks.findIndex((t) => t.id === afterId) : -1
            let insertAt = tasks.length
            let level = 1
            if (after >= 0) {
              level = tasks[after].outlineLevel
              insertAt = after + subtreeIds(tasks, afterId!).length
            }
            const task: Task = {
              id,
              no: Math.max(0, ...tasks.map((t) => t.no)) + 1,
              outlineLevel: level,
              wbs: '',
              name: '',
              phase: tasks[after]?.phase ?? '',
              status: 'Not started',
              owner: '',
              percentComplete: 0,
              schedulingMode: 'auto',
              duration: 1,
              dependencies: [],
              milestone: false,
              priority: 'Medium',
              mgmtExport: false,
              ...init,
            }
            return [...tasks.slice(0, insertAt), task, ...tasks.slice(insertAt)]
          })
          return id
        },
        updateTask: (id, patch) =>
          setTaskList((tasks) =>
            tasks.map((t) => {
              if (t.id !== id) return t
              const next: Task = { ...t, ...patch }
              if ('milestone' in patch) next.duration = patch.milestone ? 0 : Math.max(1, t.duration ?? 1)
              if ('duration' in patch && patch.duration !== undefined) next.milestone = patch.duration === 0
              if (patch.status === 'Done') next.percentComplete = 1
              if (t.schedulingMode === 'auto') {
                if (patch.currentStart && patch.currentStart !== t.currentStart) {
                  next.constraint = { type: 'SNET', date: patch.currentStart }
                }
                if (patch.currentFinish && patch.currentFinish !== t.currentFinish) {
                  const cal = new WorkCalendar(get().workspace.calendar, '2000-01-01')
                  const start = next.currentStart ?? patch.currentFinish
                  next.duration = next.milestone ? 0 : Math.max(1, cal.workdaysBetween(start, patch.currentFinish))
                }
              }
              return next
            }),
          ),
        deleteTask: (id) =>
          setTaskList((tasks) => {
            const gone = new Set(subtreeIds(tasks, id))
            return tasks
              .filter((t) => !gone.has(t.id))
              .map((t) =>
                t.dependencies.some((d) => gone.has(d.predId))
                  ? { ...t, dependencies: t.dependencies.filter((d) => !gone.has(d.predId)) }
                  : t,
              )
          }),
        setTasks: (fn) => setTaskList(fn),
        saveBaseline: (name, primary) =>
          setProject((p) => {
            const snapshot = Object.fromEntries(p.tasks.map((t) => [t.id, { start: t.currentStart, finish: t.currentFinish }]))
            const baselines = [...p.baselines, { id: newId('b'), name, createdAt: new Date().toISOString(), tasks: snapshot }]
            const tasks = primary
              ? p.tasks.map((t) => ({ ...t, baselineStart: t.currentStart, baselineFinish: t.currentFinish }))
              : p.tasks
            return { ...p, baselines, tasks }
          }),
        setPrimaryBaseline: (id) =>
          setProject((p) => {
            const b = p.baselines.find((x) => x.id === id)
            if (!b) return p
            return {
              ...p,
              tasks: p.tasks.map((t) => ({ ...t, baselineStart: b.tasks[t.id]?.start, baselineFinish: b.tasks[t.id]?.finish })),
            }
          }),
        deleteBaseline: (id) => setProject((p) => ({ ...p, baselines: p.baselines.filter((b) => b.id !== id) })),
        saveView: (view) =>
          setProject((p) => ({ ...p, views: [...p.views.filter((v) => v.id !== view.id), view] })),
        deleteView: (id) => setProject((p) => ({ ...p, views: p.views.filter((v) => v.id !== id) })),

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
        updateCalendar: (patch) =>
          setWs((ws) => {
            const calendar = { ...ws.calendar, ...patch }
            // Holidays / working days move auto-scheduled tasks in every project.
            return { ...ws, calendar, projects: ws.projects.map((p) => applySchedule(p, calendar)) }
          }),

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
