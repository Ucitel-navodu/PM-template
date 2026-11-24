import type { Project, Workspace } from '../types'

/*
 * "Hide for suppliers" mode (the eye in the header). When on, finance, the Budget / Changes / History
 * tabs and notes / comments are hidden on screen AND in every export (PDF, PPTX, Excel, CSV, a
 * downloaded copy). The flag lives here (set by prefsStore) so plain functions such as formatMoney and
 * the exporters can read it without React.
 */
let hidden = false
export const setSensitiveHidden = (v: boolean) => {
  hidden = v
  // cells / blocks marked data-sensitive are hidden by CSS (src/index.css), also in print
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('hide-sensitive', v)
}
export const sensitiveHidden = () => hidden
export const MASK = '•••'

/** Project without finance, change requests, history and notes / comments (for exports in hidden mode). */
export function redactProject(p: Project): Project {
  return {
    ...p,
    info: { ...p.info, budget: 0 },
    budget: [],
    changes: [],
    auditLog: [],
    statusReports: [],
    tasks: p.tasks.map((t) => ({ ...t, notes: undefined })),
    milestones: p.milestones.map((m) => ({ ...m, paymentTriggerPct: 0, invoiceNo: undefined, paymentStatus: 'Not due' as const, notes: undefined })),
    risks: p.risks.map((r) => ({ ...r, mitigation: '', contingency: undefined, resolution: undefined, comment: undefined, trigger: undefined })),
  }
}

export function redactWorkspace(ws: Workspace): Workspace {
  return { ...ws, projects: ws.projects.map(redactProject), absences: ws.absences.map((a) => ({ ...a, note: undefined })) }
}

/** Use the redacted project for an export when hidden mode is on. */
export const forExport = (p: Project): Project => (hidden ? redactProject(p) : p)
