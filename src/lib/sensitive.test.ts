import { describe, expect, it } from 'vitest'
import { createSampleWorkspace, parseAnyFile, serializeWorkspace } from '../domain/workspace'
import { readXlsx } from './import/xlsx'
import { exportWorkbook } from './import/workbook'
import { formatMoney } from './format'
import { MASK, redactProject, redactWorkspace, setSensitiveHidden } from './sensitive'
import { buildStatusReport } from './report'

const ws = createSampleWorkspace()
const project = ws.projects[0]

describe('hide for suppliers (the eye)', () => {
  it('the redacted project has no finance, change requests, history or notes', () => {
    const p = redactProject({ ...project, auditLog: [{ at: 'x' } as never], tasks: project.tasks.map((t) => ({ ...t, notes: 'interní' })) })
    expect(p.info.budget).toBe(0)
    expect(p.budget).toEqual([])
    expect(p.changes).toEqual([])
    expect(p.auditLog).toEqual([])
    expect(p.statusReports).toEqual([])
    expect(p.tasks.every((t) => !t.notes)).toBe(true)
    expect(p.milestones.every((m) => m.paymentTriggerPct === 0 && !m.invoiceNo && !m.notes)).toBe(true)
    expect(p.risks.every((r) => !r.mitigation && !r.resolution && !r.comment && !r.contingency)).toBe(true)
    // the plan itself stays
    expect(p.tasks.map((t) => t.name)).toEqual(project.tasks.map((t) => t.name))
    expect(p.risks.map((r) => r.id)).toEqual(project.risks.map((r) => r.id))
  })

  it('a redacted copy of the workspace is still a valid working file', () => {
    const parsed = parseAnyFile(serializeWorkspace(redactWorkspace(ws)))
    expect(parsed.kind).toBe('workspace')
  })

  it('money is masked while the eye is on', () => {
    setSensitiveHidden(true)
    expect(formatMoney(45_000_000)).toBe(MASK)
    setSensitiveHidden(false)
    expect(formatMoney(1000)).toMatch(/1\s000/)
  })

  it('the status report built for suppliers has no costs and no change requests', () => {
    const r = buildStatusReport(redactProject(project), ws.calendar, { from: '2026-07-01', to: '2026-08-31' })
    expect(r.changes.open).toEqual([])
    expect(r.budget.current).toBe(0)
    expect(r.texts.escalations).not.toContain('CR-')
  })

  it('the Excel export leaves out BUDGET, CHANGES and money / note columns', async () => {
    setSensitiveHidden(true)
    const bytes = await exportWorkbook(project, ws.calendar)
    setSensitiveHidden(false)
    const sheets = await readXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
    expect(sheets.map((s) => s.name)).toEqual(['TASKS', 'MILESTONES', 'RISKS', 'CONFIG'])
    const headers = sheets.flatMap((s) => s.rows[0].map(String))
    for (const h of ['Amount', 'Payment Trigger %', 'Invoice No', 'Notes', 'Mitigation']) expect(headers).not.toContain(h)
  })
})
