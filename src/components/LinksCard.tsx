import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useActiveProject, useWorkspaceStore } from '../store/workspaceStore'
import { newId } from '../domain/workspace'
import { Card } from './Card'
import { btnSecondary, deleteBtn } from '../lib/ui'

/** Only web links: anything else (javascript:, file:, data:) is never rendered as a link. */
export const safeUrl = (url: string): string | null => {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

/** Quick links of the project (Clarity, SharePoint, ...). */
export function LinksCard() {
  const { tr, readOnly } = useApp()
  const links = useActiveProject()?.links ?? []
  const setLinks = useWorkspaceStore.getState().setLinks
  const [editing, setEditing] = useState(false)
  const field = 'rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-white/15 dark:bg-[rgb(var(--pm-bg))] dark:text-gray-100'
  const patch = (id: string, p: { label?: string; url?: string }) => setLinks(links.map((l) => (l.id === id ? { ...l, ...p } : l)))

  return (
    <Card title={tr('links_title')} icon="🔗" accent="sky">
      <div data-testid="links-card">
        {editing ? (
          <div className="space-y-2">
            {links.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <input value={l.label} onChange={(e) => patch(l.id, { label: e.target.value })} placeholder={tr('links_label')} aria-label={tr('links_label')} className={`w-32 ${field}`} />
                <input
                  value={l.url}
                  onChange={(e) => patch(l.id, { url: e.target.value })}
                  placeholder={tr('links_url')}
                  aria-label={`${l.label} URL`}
                  aria-invalid={Boolean(l.url) && !safeUrl(l.url)}
                  title={l.url && !safeUrl(l.url) ? tr('links_invalid') : undefined}
                  className={`min-w-0 flex-1 ${field} ${l.url && !safeUrl(l.url) ? 'border-rose-400' : ''}`}
                />
                <button className={deleteBtn} onClick={() => setLinks(links.filter((x) => x.id !== l.id))} aria-label={tr('tasks_delete')}>
                  ✕
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <button className={btnSecondary} onClick={() => setLinks([...links, { id: newId('l'), label: '', url: '' }])}>
                {tr('links_add')}
              </button>
              <button className={btnSecondary} onClick={() => setEditing(false)}>
                {tr('links_done')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {links.map((l) => {
              const url = safeUrl(l.url)
              return url ? (
                <a key={l.id} href={url} target="_blank" rel="noopener noreferrer" className="rounded-md border border-brand-500/40 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-300">
                  {l.label || url} ↗
                </a>
              ) : (
                <span key={l.id} className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-400 dark:border-white/15" title={tr('links_empty')}>
                  {l.label || '—'}
                </span>
              )
            })}
            <button className={`${btnSecondary} ml-auto`} onClick={() => setEditing(true)} disabled={readOnly}>
              ✏️ {tr('common_edit')}
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}
