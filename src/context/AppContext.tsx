import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ProjectLists, Absence, BudgetItem, Lang, Milestone, ProjectInfo, Risk, Settings, Task, Theme } from '../types'
import { t, type TKey } from '../i18n'
import { useActiveProject, useWorkspaceStore, type ListKey } from '../store/workspaceStore'
import { usePrefsStore } from '../store/prefsStore'
import { bootstrapWorkspace } from '../lib/persistence/bootstrap'
import { hasUnsavedWork } from '../lib/persistence/fileSync'

export type { ListKey }

interface AppState {
  lang: Lang
  setLang: (l: Lang) => void
  tr: (key: TKey) => string
  theme: Theme
  toggleTheme: () => void
  readOnly: boolean

  projectInfo: ProjectInfo
  setProjectInfo: (p: ProjectInfo) => void

  tasks: Task[]
  addTask: (init?: Partial<Task>, afterId?: string) => string
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void

  milestones: Milestone[]
  addMilestone: (m: Milestone) => void
  updateMilestone: (id: string, patch: Partial<Milestone>) => void
  deleteMilestone: (id: string) => void

  budget: BudgetItem[]
  addBudgetItem: (b: BudgetItem) => void
  updateBudgetItem: (id: string, patch: Partial<BudgetItem>) => void
  deleteBudgetItem: (id: string) => void

  risks: Risk[]
  addRisk: (r: Risk) => void
  updateRisk: (id: string, patch: Partial<Risk>) => void
  deleteRisk: (id: string) => void

  /** Workspace calendar + active project's lists. */
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  renameListItem: (list: ListKey, oldName: string, newName: string) => void
  listItemUsage: (list: ListKey, name: string) => number

  absences: Absence[]
  addAbsence: (a: Absence) => void
  updateAbsence: (id: string, patch: Partial<Absence>) => void
  deleteAbsence: (id: string) => void
}

const LIST_KEYS: (keyof ProjectLists)[] = ['phases', 'projectAreas', 'budgetCategories', 'statuses', 'priorities']

/**
 * Facade over the workspace store for the active project. Pages keep a simple
 * API; the store does the actual work (undo/redo, read-only guard, autosave).
 */
export function useApp(): AppState {
  const lang = usePrefsStore((s) => s.lang)
  const theme = usePrefsStore((s) => s.theme)
  const setLang = usePrefsStore((s) => s.setLang)
  const toggleTheme = usePrefsStore((s) => s.toggleTheme)
  const project = useActiveProject()
  const calendar = useWorkspaceStore((s) => s.workspace.calendar)
  const absences = useWorkspaceStore((s) => s.workspace.absences)
  const readOnly = useWorkspaceStore((s) => s.readOnly)
  const a = useWorkspaceStore.getState()

  if (!project) throw new Error('No active project')

  const settings = useMemo<Settings>(() => ({ ...calendar, ...project.lists }), [calendar, project.lists])

  return {
    lang,
    setLang,
    tr: (key) => t(key, lang),
    theme,
    toggleTheme,
    readOnly,

    projectInfo: project.info,
    setProjectInfo: a.updateProjectInfo,

    tasks: project.tasks,
    addTask: (init, afterId) => a.addTask(init, afterId),
    updateTask: (id, patch) => a.updateTask(id, patch),
    deleteTask: (id) => a.deleteTask(id),

    milestones: project.milestones,
    addMilestone: (x) => a.addItem('milestones', x),
    updateMilestone: (id, patch) => a.updateItem('milestones', id, patch),
    deleteMilestone: (id) => a.deleteItem('milestones', id),

    budget: project.budget,
    addBudgetItem: (x) => a.addItem('budget', x),
    updateBudgetItem: (id, patch) => a.updateItem('budget', id, patch),
    deleteBudgetItem: (id) => a.deleteItem('budget', id),

    risks: project.risks,
    addRisk: (x) => a.addItem('risks', x),
    updateRisk: (id, patch) => a.updateItem('risks', id, patch),
    deleteRisk: (id) => a.deleteItem('risks', id),

    settings,
    updateSettings: (patch) => {
      const lists: Partial<Settings> = {}
      const cal: Partial<Settings> = {}
      for (const [k, v] of Object.entries(patch)) {
        if ((LIST_KEYS as string[]).includes(k)) Object.assign(lists, { [k]: v })
        else Object.assign(cal, { [k]: v })
      }
      if (Object.keys(lists).length) a.updateLists(lists)
      if (Object.keys(cal).length) a.updateCalendar(cal)
    },
    renameListItem: a.renameListItem,
    listItemUsage: (list, name) => {
      if (list === 'phases') return project.tasks.filter((x) => x.phase === name).length
      if (list === 'projectAreas')
        return project.tasks.filter((x) => x.projectArea === name).length + project.risks.filter((x) => x.area === name).length
      if (list === 'priorities')
        return project.tasks.filter((x) => x.priority === name).length + project.risks.filter((x) => x.priority === name).length
      return project.budget.filter((x) => x.category === name).length
    },

    absences,
    addAbsence: a.addAbsence,
    updateAbsence: a.updateAbsence,
    deleteAbsence: a.deleteAbsence,
  }
}

/** Loads the workspace (cache / migration / sample) before rendering the app. */
export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', usePrefsStore.getState().theme === 'dark')
    bootstrapWorkspace()
      .then(() => setReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))

    // Warn on close only when edits exist that are not yet in a file.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedWork()) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  if (error) return <div className="p-8 text-sm text-rose-700">Chyba při načítání dat: {error}</div>
  if (!ready) return <div className="p-8 text-sm text-gray-500">Načítám…</div>
  return <>{children}</>
}
