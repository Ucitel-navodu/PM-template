import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { BudgetItem, Lang, Milestone, ProjectInfo, Risk, Task, Theme } from '../types'
import { projectInfo as seedProjectInfo, seedBudget, seedMilestones, seedRisks, seedTasks } from '../data/seed'
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

  resetToSeed: () => void

  exportProject: () => void
  importProject: (bundle: ProjectBundle) => void
}

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

      resetToSeed: () => {
        setProjectInfo(seedProjectInfo)
        setTasks(seedTasks)
        setMilestones(seedMilestones)
        setBudget(seedBudget)
        setRisks(seedRisks)
      },

      exportProject: () => {
        downloadProjectFile(buildProjectBundle({ projectInfo, tasks, milestones, budget, risks }))
      },
      importProject: (bundle) => {
        setProjectInfo(bundle.projectInfo)
        setTasks(bundle.tasks)
        setMilestones(bundle.milestones)
        setBudget(bundle.budget)
        setRisks(bundle.risks)
      },
    }),
    [lang, theme, projectInfo, tasks, milestones, budget, risks],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
