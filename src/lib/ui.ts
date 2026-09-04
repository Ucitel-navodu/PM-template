// Shared Tailwind class strings for table-based CRUD pages (Tasks, Milestones, Budget, Risks)
// so light/dark styling stays consistent without repeating long class lists everywhere.

export const tableWrap =
  'overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#1d1d29]'

export const theadRow =
  'border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400'

export const tbodyRow = 'border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5'

export const tfootRow =
  'border-t border-gray-200 bg-gray-50 font-medium dark:border-white/10 dark:bg-white/5 dark:text-gray-100'

export const inputGhost =
  'rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-gray-200 focus:border-gray-300 focus:bg-white focus:outline-none dark:text-gray-100 dark:hover:border-white/20 dark:focus:border-white/30 dark:focus:bg-white/10'

export const selectGhost = `${inputGhost} text-xs`

export const selectFilter =
  'rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-white/15 dark:bg-[#1d1d29] dark:text-gray-200'

export const btnPrimary = 'rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700'

export const btnSecondary =
  'rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10'

export const deleteBtn = 'text-xs text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400'

export const cellMuted = 'px-3 py-1.5 text-gray-500 dark:text-gray-400'
