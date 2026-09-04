import type { ReactNode } from 'react'

export type Accent = 'indigo' | 'violet' | 'sky' | 'amber' | 'emerald' | 'rose' | 'slate'

const ACCENT_CLASSES: Record<Accent, string> = {
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
}

export function Card({
  title,
  icon,
  accent = 'slate',
  children,
  className = '',
}: {
  title?: string
  icon?: string
  accent?: Accent
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1d1d29] ${className}`}
    >
      {title && (
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          {icon && (
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-sm ${ACCENT_CLASSES[accent]}`}
            >
              {icon}
            </span>
          )}
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-xl font-semibold text-gray-900 dark:text-gray-50">{value}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-gray-500">{sub}</div>}
    </div>
  )
}
