import type { Workspace } from '../../types'
import { parseAnyFile, serializeWorkspace, WorkspaceFileError, type ParsedFile } from '../../domain/workspace'
import { readXlsx, writeXlsx, type OutSheet } from '../import/xlsx'
import { projectSheets } from '../import/workbook'

/*
 * The working file can be saved under several extensions, because document
 * stores (SharePoint, mail gateways) often refuse .json:
 *   .pmw / .txt / .pmw.json - the same JSON text, only the extension differs
 *   .xlsx - a real workbook: readable sheets of the active project for people
 *           without the app + the complete workspace in a hidden sheet
 *           (lossless; the readable sheets are never read back).
 * Reading does not trust the extension: the content decides.
 */

export type FileFormat = 'pmw' | 'xlsx' | 'txt' | 'json'

export const FORMATS: Record<FileFormat, { ext: string; pickerExt: string; mime: string }> = {
  pmw: { ext: '.pmw', pickerExt: '.pmw', mime: 'application/x-pm-workspace' },
  xlsx: { ext: '.xlsx', pickerExt: '.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  txt: { ext: '.txt', pickerExt: '.txt', mime: 'text/plain' },
  json: { ext: '.pmw.json', pickerExt: '.json', mime: 'application/json' },
}
export const FORMAT_ORDER: FileFormat[] = ['pmw', 'xlsx', 'txt', 'json']

export function formatOfName(name: string): FileFormat {
  const n = name.toLowerCase()
  if (n.endsWith('.xlsx')) return 'xlsx'
  if (n.endsWith('.txt')) return 'txt'
  if (n.endsWith('.json')) return 'json'
  return 'pmw'
}

export const DATA_SHEET = 'PM_DATA'
const MAGIC = 'pm-web-workspace'
const CHUNK = 30_000 // an Excel cell holds at most 32 767 characters

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
function fromBase64(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/** Sheets of the workbook variant of the working file. */
export function workspaceSheets(ws: Workspace, activeProjectId?: string): OutSheet[] {
  const project = ws.projects.find((p) => p.id === activeProjectId) ?? ws.projects[0]
  const info: OutSheet = {
    name: 'README',
    headers: ['PM Web – pracovní soubor / working file'],
    widths: [110],
    rows: [
      ['Tento sešit je pracovní soubor aplikace PM Web. Otevři ho v aplikaci: Soubor → Otevřít soubor…'],
      ['Listy TASKS, MILESTONES, BUDGET… jsou jen pro čtení (náhled aktivního projektu). Změny v nich aplikace NENAČTE – použij Soubor → Import.'],
      ['Kompletní data jsou ve skrytém listu PM_DATA. Neměň ho a nemaž.'],
      ['This workbook is a PM Web working file. The visible sheets are a read-only preview; the complete data is in the hidden sheet PM_DATA.'],
      [],
      [`Uloženo / saved: ${ws.savedAt ?? ''}`],
      [`Uložil(a) / saved by: ${ws.savedBy ?? ''}`],
      [`Revize / revision: ${ws.revision}`],
      [`Projekty / projects (${ws.projects.length}): ${ws.projects.map((p) => p.info.projectName).join(', ')}`],
      [project ? `Náhled / preview: ${project.info.projectName}` : ''],
    ],
  }
  const b64 = toBase64(serializeWorkspace(ws))
  const chunks: string[][] = []
  for (let i = 0; i < b64.length; i += CHUNK) chunks.push([b64.slice(i, i + CHUNK)])
  const data: OutSheet = { name: DATA_SHEET, headers: [MAGIC, 'base64', String(b64.length)], rows: chunks, hidden: true, plain: true }
  return [info, ...(project ? projectSheets(project, ws.calendar) : []), data]
}

export async function encodeWorkspace(ws: Workspace, format: FileFormat, activeProjectId?: string): Promise<Blob> {
  if (format === 'xlsx') return new Blob([(await writeXlsx(workspaceSheets(ws, activeProjectId))) as BlobPart], { type: FORMATS.xlsx.mime })
  return new Blob([serializeWorkspace(ws)], { type: FORMATS[format].mime })
}

/** Read a working file of any supported format. */
export async function decodeWorkspaceFile(file: Blob): Promise<ParsedFile> {
  // One read of the whole file: the bytes decide (zip = workbook, otherwise JSON text).
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return parseAnyFile(new TextDecoder().decode(bytes))
  const sheets = await readXlsx(bytes.buffer as ArrayBuffer)
  const data = sheets.find((s) => s.name === DATA_SHEET)
  if (!data || String(data.rows[0]?.[0] ?? '') !== MAGIC) {
    throw new WorkspaceFileError('Tento sešit není pracovní soubor aplikace (chybí list PM_DATA). Běžný Excel načti přes Soubor → Import.')
  }
  const b64 = data.rows.slice(1).map((r) => String(r[0] ?? '')).join('')
  const expected = Number(data.rows[0]?.[2])
  if (Number.isFinite(expected) && expected !== b64.length) throw new WorkspaceFileError('List PM_DATA je poškozený nebo neúplný – soubor nelze bezpečně načíst.')
  let text: string
  try {
    text = fromBase64(b64)
  } catch {
    throw new WorkspaceFileError('List PM_DATA je poškozený – soubor nelze načíst.')
  }
  return parseAnyFile(text)
}
