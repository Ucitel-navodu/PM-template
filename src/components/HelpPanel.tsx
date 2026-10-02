import { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { helpContent } from '../data/help'

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const { tr, lang } = useApp()
  const sections = helpContent[lang]

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr('help_title')}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1d1d29]"
      >
        <div className="sticky top-0 flex items-center justify-between rounded-t-xl border-b border-gray-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-[#1d1d29]">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">{tr('help_title')}</h2>
          <button
            onClick={onClose}
            aria-label={tr('help_close')}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {sections.map((section) => (
            <div key={section.title} className="mb-5 last:mb-0">
              <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">{section.title}</h3>
              <div className="space-y-1.5">
                {section.items.map((item) => (
                  <details
                    key={item.q}
                    className="group rounded-lg border border-gray-100 bg-gray-50 open:bg-white dark:border-white/5 dark:bg-white/[0.03] dark:open:bg-white/[0.06]"
                  >
                    <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium text-gray-700 marker:content-none dark:text-gray-200">
                      <span className="mr-2 inline-block w-3 text-gray-400 transition-transform group-open:rotate-90">
                        ›
                      </span>
                      {item.q}
                    </summary>
                    <p className="px-3 pb-3 pl-8 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
