import { useState } from 'react'
import { useApp } from './context/AppContext'
import type { TKey } from './i18n'
import { Dashboard } from './pages/Dashboard'
import { TasksPage } from './pages/Tasks'
import { GanttPage } from './pages/Gantt'
import { MilestonesPage } from './pages/Milestones'
import { BudgetPage } from './pages/Budget'
import { RisksPage } from './pages/Risks'

type PageKey = 'dashboard' | 'tasks' | 'gantt' | 'milestones' | 'budget' | 'risks'

const TABS: { key: PageKey; label: TKey }[] = [
  { key: 'dashboard', label: 'nav_dashboard' },
  { key: 'tasks', label: 'nav_tasks' },
  { key: 'gantt', label: 'nav_gantt' },
  { key: 'milestones', label: 'nav_milestones' },
  { key: 'budget', label: 'nav_budget' },
  { key: 'risks', label: 'nav_risks' },
]

export default function App() {
  const { tr, lang, setLang, projectInfo } = useApp()
  const [page, setPage] = useState<PageKey>('dashboard')

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{tr('app_title')}</div>
            <div className="text-lg font-semibold text-gray-900">{projectInfo.projectName}</div>
          </div>
          <nav className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPage(tab.key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  page === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tr(tab.label)}
              </button>
            ))}
          </nav>
          <button
            onClick={() => setLang(lang === 'CZ' ? 'EN' : 'CZ')}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            {tr('lang_switch')}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {page === 'dashboard' && <Dashboard />}
        {page === 'tasks' && <TasksPage />}
        {page === 'gantt' && <GanttPage />}
        {page === 'milestones' && <MilestonesPage />}
        {page === 'budget' && <BudgetPage />}
        {page === 'risks' && <RisksPage />}
      </main>
    </div>
  )
}
