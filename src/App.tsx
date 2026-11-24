import { useEffect, useState } from 'react'
import { useApp } from './context/AppContext'
import type { TKey } from './i18n'
import { useWorkspaceStore } from './store/workspaceStore'
import { Dashboard } from './pages/Dashboard'
import { TasksPage } from './pages/Tasks'
import { GanttPage } from './pages/Gantt'
import { BoardPage } from './pages/Board'
import { MilestonesPage } from './pages/Milestones'
import { BudgetPage } from './pages/Budget'
import { RisksPage } from './pages/Risks'
import { ChangesPage } from './pages/Changes'
import { AuditPage } from './pages/Audit'
import { ReportPage } from './pages/Report'
import { TeamPage } from './pages/Team'
import { PortfolioPage } from './pages/Portfolio'
import { FileMenu } from './components/FileMenu'
import { SyncBanner } from './components/SyncBanner'
import { HelpPanel } from './components/HelpPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { ThemedLogo } from './components/Brand'
import { usePrefsStore } from './store/prefsStore'
import { closeSettings, openSettings, useSettingsNav } from './lib/settingsNav'

type PageKey = 'portfolio' | 'dashboard' | 'tasks' | 'board' | 'gantt' | 'milestones' | 'budget' | 'risks' | 'changes' | 'team' | 'audit' | 'report'

/** Tabs hidden for suppliers (the eye): finance, change requests, history. */
const SENSITIVE_PAGES: PageKey[] = ['budget', 'changes', 'audit']

const TABS: { key: PageKey; label: TKey }[] = [
  { key: 'portfolio', label: 'nav_portfolio' },
  { key: 'dashboard', label: 'nav_dashboard' },
  { key: 'tasks', label: 'nav_tasks' },
  { key: 'gantt', label: 'nav_gantt' },
  { key: 'board', label: 'nav_board' },
  { key: 'milestones', label: 'nav_milestones' },
  { key: 'budget', label: 'nav_budget' },
  { key: 'risks', label: 'nav_raid' },
  { key: 'changes', label: 'nav_changes' },
  { key: 'team', label: 'nav_team' },
  { key: 'report', label: 'nav_report' },
  { key: 'audit', label: 'nav_audit' },
]

// Hash routing (#/tasks) works from file:// and survives reloads.
function readHash(): PageKey {
  const key = window.location.hash.replace(/^#\/?/, '') as PageKey
  return TABS.some((t) => t.key === key) ? key : 'dashboard'
}

function useHashPage(): [PageKey, (p: PageKey) => void] {
  const [page, setPage] = useState<PageKey>(readHash)
  useEffect(() => {
    const onHash = () => setPage(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return [page, (p) => (window.location.hash = `/${p}`)]
}

const iconBtn =
  'flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10'

function ProjectSwitcher() {
  const { tr } = useApp()
  const projects = useWorkspaceStore((s) => s.workspace.projects)
  const activeId = useWorkspaceStore((s) => s.activeProjectId)
  return (
    <label className="flex min-w-0 flex-col">
      <span className="text-[11px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-300">Project Manager · {tr('switcher_label')}</span>
      <select
        value={activeId}
        onChange={(e) => useWorkspaceStore.getState().setActiveProject(e.target.value)}
        className="max-w-[22rem] truncate rounded-md border-0 bg-transparent p-0 pr-6 text-lg font-semibold leading-tight text-gray-900 focus:ring-0 dark:bg-[rgb(var(--pm-bg))] dark:text-gray-50"
        aria-label={tr('switcher_label')}
      >
        {projects
          .filter((p) => !p.archived || p.id === activeId)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.info.projectName}
            </option>
          ))}
      </select>
    </label>
  )
}

export default function App() {
  const { tr, lang, setLang, theme, toggleTheme, readOnly } = useApp()
  const [page, setPage] = useHashPage()
  const [helpOpen, setHelpOpen] = useState(false)
  const settingsPanel = useSettingsNav((s) => s.panel)
  const hidden = usePrefsStore((s) => s.hideSensitive)
  const tabs = TABS.filter((t) => !hidden || !SENSITIVE_PAGES.includes(t.key))
  // A hidden tab (Budget, Changes, History) shows the dashboard while the eye is on.
  const shown: PageKey = hidden && SENSITIVE_PAGES.includes(page) ? 'dashboard' : page

  return (
    <div className="min-h-full bg-gray-50 print:bg-white dark:bg-[rgb(var(--pm-bg))]">
      <header className="sticky top-0 z-20 print:hidden border-b border-gray-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-[rgb(var(--pm-bg)/0.95)]">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 pt-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* Trade mark with its exclusion zone (padding), then the app name and the project. */}
            <ThemedLogo height={32} className="-m-2 hidden sm:inline-flex" />
            <div className="hidden h-9 w-px shrink-0 bg-gray-200 sm:block dark:bg-white/15" />
            <ProjectSwitcher />
          </div>

          <div className="flex items-center gap-2">
            <FileMenu />
            <div className="h-5 w-px bg-gray-200 dark:bg-white/10" />
            <button
              onClick={() => usePrefsStore.getState().setHideSensitive(!hidden)}
              aria-pressed={hidden}
              aria-label={tr(hidden ? 'sensitive_show' : 'sensitive_hide')}
              title={tr(hidden ? 'sensitive_show' : 'sensitive_hide')}
              data-testid="sensitive-toggle"
              className={`${iconBtn} ${hidden ? '!border-brand-600 !bg-brand-600 !text-white' : ''}`}
            >
              {hidden ? '🙈' : '👁️'}
            </button>
            <button onClick={() => openSettings()} aria-label={tr('settings_button')} title={tr('settings_button')} className={iconBtn}>
              ⚙️
            </button>
            <button onClick={() => setHelpOpen(true)} aria-label={tr('help_button')} title={tr('help_button')} className={iconBtn}>
              ❓
            </button>
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? tr('theme_light') : tr('theme_dark')}
              title={theme === 'dark' ? tr('theme_light') : tr('theme_dark')}
              className={iconBtn}
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
        <nav className="mx-auto flex max-w-[90rem] flex-wrap items-center gap-1 px-4 pb-2 pt-2 sm:px-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPage(tab.key)}
              aria-current={shown === tab.key ? 'page' : undefined}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                shown === tab.key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100'
              } ${tab.key === 'portfolio' ? 'mr-2' : ''}`}
            >
              {tr(tab.label)}
            </button>
          ))}
        </nav>
        {hidden && (
          <div className="border-t border-brand-600/30 bg-brand-600 px-4 py-1 text-center text-xs font-semibold text-white print:hidden" data-testid="sensitive-banner">
            🙈 {tr('sensitive_banner')}
          </div>
        )}
        <SyncBanner />
      </header>

      <main className={`mx-auto max-w-[90rem] px-4 py-6 sm:px-6 print:max-w-none print:p-0 ${readOnly ? 'read-only' : ''}`}>
        {shown === 'portfolio' && <PortfolioPage onOpenProject={() => setPage('dashboard')} />}
        {shown === 'dashboard' && <Dashboard />}
        {shown === 'tasks' && <TasksPage onOpenSettings={() => openSettings('phases')} />}
        {shown === 'gantt' && <GanttPage />}
        {shown === 'board' && <BoardPage />}
        {shown === 'milestones' && <MilestonesPage />}
        {shown === 'budget' && <BudgetPage />}
        {shown === 'risks' && <RisksPage />}
        {shown === 'changes' && <ChangesPage />}
        {shown === 'team' && <TeamPage />}
        {shown === 'audit' && <AuditPage />}
        {shown === 'report' && <ReportPage />}
      </main>

      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
      {settingsPanel && <SettingsPanel key={settingsPanel} initial={settingsPanel} onClose={closeSettings} />}
    </div>
  )
}
