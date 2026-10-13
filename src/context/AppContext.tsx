import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Absence, BudgetItem, Lang, Milestone, ProjectInfo, Risk, Settings, Task, Theme } from '../types'
import { projectInfo as seedProjectInfo, seedAbsences, seedBudget, seedMilestones, seedRisks, seedTasks } from '../data/seed'
import { defaultSettings, withSettingsDefaults } from '../data/settings'
import { loadState, saveState } from '../lib/storage'
import { t, type TKey } from '../i18n'
import { buildProjectBundle, downloadProjectFile, type ProjectBundle } from '../lib/projectFile'

interface AppState {
  lang: Lang
  setLang: (l: Lang) => void
  tr: (key: TKey) => string

  theme: Theme
  toggleTheme: () => void

  projectInfo: ProjectInfo
  setProjectInfo: (p: ProjectInfo) => void

  tasks: Task[]
  addTask: (task: Task) => void
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

  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  // Rename an item in one of the editable lists and carry the new name over
  // to every task/risk/budget line that uses it.
  renameListItem: (list: ListKey, oldName: string, newName: string) => void
  listItemUsage: (list: ListKey, name: string) => number

  absences: Absence[]
  addAbsence: (a: Absence) => void
  updateAbsence: (id: string, patch: Partial<Absence>) => void
  deleteAbsence: (id: string) => void

  resetToSeed: () => void

  exportProject: () => void
  importProject: (bundle: ProjectBundle) => void
  hasUnsavedChanges: boolean
  lastExportedAt: string | null
}

export type ListKey = 'phases' | 'projectAreas' | 'budgetCategories'

const AppContext = createContext<AppState | null>(null)

function prefersDarkSystem(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => loadState('lang', 'CZ' as Lang))
  const [theme, setTheme] = useState<Theme>(() => loadState<Theme>('theme', prefersDarkSystem() ? 'dark' : 'light'))
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>(() => loadState('projectInfo', seedProjectInfo))
  const [tasks, setTasks] = useState<Task[]>(() => loadState('tasks', seedTasks))
  const [milestones, setMilestones] = useState<Milestone[]>(() => loadState('milestones', seedMilestones))
  const [budget, setBudget] = useState<BudgetItem[]>(() => loadState('budget', seedBudget))
  const [risks, setRisks] = useState<Risk[]>(() => loadState('risks', seedRisks))
  const [settings, setSettings] = useState<Settings>(() => withSettingsDefaults(loadState('settings', defaultSettings)))
  const [absences, setAbsences] = useState<Absence[]>(() => loadState('absences', seedAbsences))

  const [lastExportedAt, setLastExportedAt] = useState<string | null>(() => loadState('lastExportedAt', null))
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const isFirstDataRun = useRef(true)

  // Mark "unsaved" whenever project data changes - but not on the very first
  // render, where this is just the initial load from storage/seed, not a
  // real edit. Only resets to false via an explicit export or import.
  useEffect(() => {
    if (isFirstDataRun.current) {
      isFirstDataRun.current = false
      return
    }
    setHasUnsavedChanges(true)
  }, [projectInfo, tasks, milestones, budget, risks, settings, absences])

  // Warn on tab close/refresh if there's anything not yet exported. This
  // catches a normal close, reload, or a graceful "restart to update" -
  // it cannot catch a hard crash or a forced process kill, since no JS
  // runs in that case (localStorage itself is already safe from those:
  // every write is persisted to disk immediately, not just on clean exit).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  useEffect(() => saveState('lastExportedAt', lastExportedAt), [lastExportedAt])
  useEffect(() => saveState('lang', lang), [lang])
  useEffect(() => {
    saveState('theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  useEffect(() => saveState('projectInfo', projectInfo), [projectInfo])
  useEffect(() => saveState('tasks', tasks), [tasks])
  useEffect(() => saveState('milestones', milestones), [milestones])
  useEffect(() => saveState('budget', budget), [budget])
  useEffect(() => saveState('risks', risks), [risks])
  useEffect(() => saveState('settings', settings), [settings])
  useEffect(() => saveState('absences', absences), [absences])

  const value = useMemo<AppState>(
    () => ({
      lang,
      setLang,
      tr: (key: TKey) => t(key, lang),

      theme,
      toggleTheme: () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light')),

      projectInfo,
      setProjectInfo,

      tasks,
      addTask: (task) => setTasks((prev) => [...prev, task]),
      updateTask: (id, patch) => setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x))),
      deleteTask: (id) => setTasks((prev) => prev.filter((x) => x.id !== id)),

      milestones,
      addMilestone: (m) => setMilestones((prev) => [...prev, m]),
      updateMilestone: (id, patch) => setMilestones((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x))),
      deleteMilestone: (id) => setMilestones((prev) => prev.filter((x) => x.id !== id)),

      budget,
      addBudgetItem: (b) => setBudget((prev) => [...prev, b]),
      updateBudgetItem: (id, patch) => setBudget((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x))),
      deleteBudgetItem: (id) => setBudget((prev) => prev.filter((x) => x.id !== id)),

      risks,
      addRisk: (r) => setRisks((prev) => [...prev, r]),
      updateRisk: (id, patch) => setRisks((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x))),
      deleteRisk: (id) => setRisks((prev) => prev.filter((x) => x.id !== id)),

      settings,
      updateSettings: (patch) => setSettings((prev) => ({ ...prev, ...patch })),
      renameListItem: (list, oldName, newName) => {
        if (!newName || oldName === newName) return
        setSettings((prev) => ({ ...prev, [list]: prev[list].map((x) => (x === oldName ? newName : x)) }))
        if (list === 'phases') {
          setTasks((prev) => prev.map((x) => (x.phase === oldName ? { ...x, phase: newName } : x)))
        } else if (list === 'projectAreas') {
          setTasks((prev) => prev.map((x) => (x.projectArea === oldName ? { ...x, projectArea: newName } : x)))
          setRisks((prev) => prev.map((x) => (x.area === oldName ? { ...x, area: newName } : x)))
        } else {
          setBudget((prev) => prev.map((x) => (x.category === oldName ? { ...x, category: newName } : x)))
        }
      },
      listItemUsage: (list, name) => {
        if (list === 'phases') return tasks.filter((x) => x.phase === name).length
        if (list === 'projectAreas')
          return tasks.filter((x) => x.projectArea === name).length + risks.filter((x) => x.area === name).length
        return budget.filter((x) => x.category === name).length
      },

      absences,
      addAbsence: (a) => setAbsences((prev) => [...prev, a]),
      updateAbsence: (id, patch) => setAbsences((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x))),
      deleteAbsence: (id) => setAbsences((prev) => prev.filter((x) => x.id !== id)),

      resetToSeed: () => {
        setProjectInfo(seedProjectInfo)
        setTasks(seedTasks)
        setMilestones(seedMilestones)
        setBudget(seedBudget)
        setRisks(seedRisks)
        setSettings(defaultSettings)
        setAbsences(seedAbsences)
      },

      exportProject: () => {
        downloadProjectFile(buildProjectBundle({ projectInfo, tasks, milestones, budget, risks, settings, absences }))
        setHasUnsavedChanges(false)
        setLastExportedAt(new Date().toISOString())
      },
      importProject: (bundle) => {
        setProjectInfo(bundle.projectInfo)
        setTasks(bundle.tasks)
        setMilestones(bundle.milestones)
        setBudget(bundle.budget)
        setRisks(bundle.risks)
        setSettings(bundle.settings)
        setAbsences(bundle.absences)
        setHasUnsavedChanges(false)
      },
      hasUnsavedChanges,
      lastExportedAt,
    }),
    [lang, theme, projectInfo, tasks, milestones, budget, risks, settings, absences, hasUnsavedChanges, lastExportedAt],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
