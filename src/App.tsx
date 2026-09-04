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
  const { tr, lang, setLang, theme, toggleTheme, projectInfo } = useApp()
  const [page, setPage] = useState<PageKey>('dashboard')

  return (
    <div className="min-h-full bg-gray-50 dark:bg-[#14141c]">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#1a1a24]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500 text-sm font-bold text-white shadow-sm shadow-brand-500/30">
              PM
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {tr('app_title')}
              </div>
              <div className="text-lg font-semibold leading-tight text-gray-900 dark:text-gray-50">
                {projectInfo.projectName}
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-white/5 md:flex">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPage(tab.key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  page === tab.key
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100'
                }`}
              >
                {tr(tab.label)}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? tr('theme_light') : tr('theme_dark')}
              title={theme === 'dark' ? tr('theme_light') : tr('theme_dark')}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              onClick={() => setLang(lang === 'CZ' ? 'EN' : 'CZ')}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10"
            >
              {tr('lang_switch')}
            </button>
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-gray-100 px-4 py-1.5 dark:border-white/10 md:hidden">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPage(tab.key)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                page === tab.key
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100'
              }`}
            >
              {tr(tab.label)}
            </button>
          ))}
        </nav>
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
