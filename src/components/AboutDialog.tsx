import { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import licenses from '../generated/licenses.json'
import sbom from '../generated/sbom.json'
import { btnSecondary } from '../lib/ui'

function downloadSbom() {
  const blob = new Blob([JSON.stringify(sbom, null, 2)], { type: 'application/vnd.cyclonedx+json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `pm-web-${__APP_VERSION__}.cdx.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function AboutDialog({ onClose }: { onClose: () => void }) {
  const { tr } = useApp()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr('about_title')}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1d1d29]"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">ℹ️ {tr('about_title')}</h2>
          <button
            onClick={onClose}
            aria-label={tr('help_close')}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[72vh] space-y-5 overflow-y-auto px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
          <p>
            <span className="font-semibold">Project Manager Web</span> · {tr('about_version')} {__APP_VERSION__} ({__BUILD_DATE__})
          </p>
          <div>
            <h3 className="mb-1 font-semibold text-gray-800 dark:text-gray-100">{tr('about_security')}</h3>
            <ul className="list-disc space-y-1 pl-5">
              {tr('about_security_points')
                .split('|')
                .map((point) => (
                  <li key={point}>{point}</li>
                ))}
            </ul>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">{tr('about_licenses')}</h3>
              <button className={btnSecondary} onClick={downloadSbom}>
                {tr('about_sbom')}
              </button>
            </div>
            <div className="space-y-1">
              {licenses.map((p) => (
                <details key={`${p.name}@${p.version}`} className="rounded border border-gray-100 dark:border-white/10">
                  <summary className="flex cursor-pointer justify-between gap-2 px-3 py-1.5">
                    <span>
                      {p.name} <span className="text-gray-400">{p.version}</span>
                    </span>
                    <span className="text-xs text-gray-500">{p.license}</span>
                  </summary>
                  <pre className="max-h-60 overflow-auto whitespace-pre-wrap border-t border-gray-100 px-3 py-2 text-[11px] text-gray-500 dark:border-white/10">
                    {p.text || p.license}
                  </pre>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
