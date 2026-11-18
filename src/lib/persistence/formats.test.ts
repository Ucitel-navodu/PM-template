import { describe, expect, it } from 'vitest'
import { createSampleProject, createWorkspace, serializeWorkspace, WorkspaceFileError } from '../../domain/workspace'
import { readXlsx, writeXlsx } from '../import/xlsx'
import { DATA_SHEET, decodeWorkspaceFile, encodeWorkspace, formatOfName, FORMAT_ORDER } from './formats'

const workspace = () => {
  const ws = createWorkspace([createSampleProject()])
  // long text + characters that XML / Excel like to mangle
  ws.projects[0].tasks[0].notes = `řádek 1\r\nřádek 2\t<b>&"'</b> _x000D_ 🚀 ${'dlouhý text '.repeat(6000)}`
  return ws
}

describe('working file formats', () => {
  it('recognises the format from the file name', () => {
    expect(['a.pmw', 'a.XLSX', 'a.txt', 'a.pmw.json', 'noext'].map(formatOfName)).toEqual(['pmw', 'xlsx', 'txt', 'json', 'pmw'])
  })

  it('round-trips the whole workspace losslessly in every format', async () => {
    const ws = workspace()
    // Reading runs the usual migrations; every format must give exactly what the plain JSON gives.
    const viaJson = await decodeWorkspaceFile(new Blob([serializeWorkspace(ws)]))
    if (viaJson.kind !== 'workspace') throw new Error('not a workspace')
    expect(viaJson.workspace.projects[0].tasks[0].notes).toBe(ws.projects[0].tasks[0].notes)
    for (const f of FORMAT_ORDER) {
      const parsed = await decodeWorkspaceFile(await encodeWorkspace(ws, f))
      expect(parsed.kind, f).toBe('workspace')
      if (parsed.kind === 'workspace') expect(serializeWorkspace(parsed.workspace), f).toBe(serializeWorkspace(viaJson.workspace))
    }
  })

  it('the workbook has readable sheets and a hidden data sheet with cells Excel can hold', async () => {
    const blob = await encodeWorkspace(workspace(), 'xlsx')
    const sheets = await readXlsx(await blob.arrayBuffer())
    expect(sheets.map((s) => s.name)).toEqual(['README', 'TASKS', 'MILESTONES', 'BUDGET', 'RISKS', 'CHANGES', 'CONFIG', DATA_SHEET])
    const data = sheets.at(-1)!
    expect(data.rows.length).toBeGreaterThan(3) // chunked
    expect(Math.max(...data.rows.map((r) => String(r[0] ?? '').length))).toBeLessThanOrEqual(32_767)
  })

  it('refuses an ordinary workbook and a truncated data sheet', async () => {
    const plain = new Blob([(await writeXlsx([{ name: 'TASKS', headers: ['Task Name'], rows: [['x']] }])) as BlobPart])
    await expect(decodeWorkspaceFile(plain)).rejects.toThrow(WorkspaceFileError)
    const sheets = await readXlsx(await (await encodeWorkspace(workspace(), 'xlsx')).arrayBuffer())
    const data = sheets.at(-1)!
    const cut = new Blob([(await writeXlsx([{ name: DATA_SHEET, headers: data.rows[0].map(String), rows: data.rows.slice(1, -1) as string[][], plain: true }])) as BlobPart])
    await expect(decodeWorkspaceFile(cut)).rejects.toThrow(/PM_DATA/)
  })
})
