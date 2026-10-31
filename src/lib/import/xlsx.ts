import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import { ImportError } from './msp'
import type { Cell, Table } from './csv'

/*
 * Minimal .xlsx reader / writer on jszip + fast-xml-parser (both MIT).
 * ExcelJS was rejected: its dependency tree contains packages with
 * "Unlicense" / unknown licences, which would break the permissive-only rule.
 * Reads values only (strings, numbers, booleans, shared/inline strings);
 * writes plain sheets with a header style, date format, widths, a frozen
 * header row and an auto filter.
 */

const MAX_BYTES = 60 * 1024 * 1024
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', parseTagValue: false, removeNSPrefix: true, processEntities: true, isArray: (n) => ['row', 'c', 'si', 'sheet', 'Relationship', 'r'].includes(n) })
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v])

function colIndex(ref: string): number {
  let n = 0
  for (const ch of /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? '') n = n * 26 + ch.charCodeAt(0) - 64
  return n - 1
}

/** Text of a shared / inline string item (plain `<t>` or rich-text runs `<r><t>`). */
function itemText(si: Record<string, unknown> | undefined): string {
  if (!si) return ''
  const t = (v: unknown) => (typeof v === 'object' && v !== null ? String((v as Record<string, unknown>)['#text'] ?? '') : String(v ?? ''))
  if (si.t !== undefined) return t(si.t)
  return arr(si.r as Record<string, unknown>[] | undefined).map((r) => t(r.t)).join('')
}

export interface Sheet {
  name: string
  rows: Cell[][]
}

export async function readXlsx(data: ArrayBuffer): Promise<Sheet[]> {
  if (data.byteLength > MAX_BYTES) throw new ImportError('Soubor je příliš velký.')
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(data)
  } catch {
    throw new ImportError('Soubor není platný .xlsx (starší formát .xls ulož v Excelu jako .xlsx).')
  }
  const read = async (path: string) => (await zip.file(path)?.async('string')) ?? ''
  const wbXml = await read('xl/workbook.xml')
  if (!wbXml) throw new ImportError('Soubor není platný .xlsx (chybí xl/workbook.xml).')
  const workbook = parser.parse(wbXml).workbook ?? {}
  const rels = new Map<string, string>()
  for (const r of arr<Record<string, string>>(parser.parse(await read('xl/_rels/workbook.xml.rels')).Relationships?.Relationship)) rels.set(r['@Id'], r['@Target'])
  const shared = arr<Record<string, unknown>>(parser.parse((await read('xl/sharedStrings.xml')) || '<sst/>').sst?.si).map(itemText)

  const sheets: Sheet[] = []
  for (const s of arr<Record<string, string>>(workbook.sheets?.sheet)) {
    const target = rels.get(s['@id']) ?? ''
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`
    const xml = await read(path)
    if (!xml) continue
    const rows: Cell[][] = []
    for (const row of arr<Record<string, unknown>>(parser.parse(xml).worksheet?.sheetData?.row)) {
      const r = Number(row['@r'] ?? rows.length + 1) - 1
      const cells: Cell[] = []
      for (const c of arr<Record<string, unknown>>(row.c as Record<string, unknown>[] | undefined)) {
        const idx = colIndex(String(c['@r'] ?? ''))
        const type = String(c['@t'] ?? 'n')
        const v = c.v === undefined ? undefined : typeof c.v === 'object' ? String((c.v as Record<string, unknown>)['#text'] ?? '') : String(c.v)
        let value: Cell = null
        if (type === 's') value = shared[Number(v)] ?? ''
        else if (type === 'inlineStr') value = itemText(c.is as Record<string, unknown>)
        else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE'
        else if (type === 'str' || type === 'e') value = v ?? ''
        else if (v !== undefined && v !== '') value = Number.isFinite(Number(v)) ? Number(v) : v
        if (value !== null) cells[idx >= 0 ? idx : cells.length] = value
      }
      rows[r] = Array.from(cells, (c) => c ?? null)
    }
    sheets.push({ name: s['@name'], rows: Array.from(rows, (r) => r ?? []) })
  }
  if (sheets.length === 0) throw new ImportError('Sešit neobsahuje žádný list.')
  return sheets
}

/** First non-empty row = headers. */
export function sheetToTable(sheet: Sheet): Table {
  const first = sheet.rows.findIndex((r) => r.some((c) => c !== null && String(c).trim() !== ''))
  if (first < 0) return { name: sheet.name, headers: [], rows: [] }
  const headers = sheet.rows[first].map((h) => String(h ?? '').trim())
  const rows = sheet.rows.slice(first + 1).filter((r) => r.some((c) => c !== null && String(c).trim() !== ''))
  return { name: sheet.name, headers, rows }
}

// --- writer -----------------------------------------------------------------------------

export type OutCell = string | number | boolean | Date | null | undefined
export interface OutSheet {
  name: string
  headers: string[]
  rows: OutCell[][]
  widths?: number[]
}

const ENTITY: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }
const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ENTITY[c]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
const colName = (i: number) => {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
/** Local date -> Excel serial number (days since 1899-12-30, the 1900 leap-year bug included). */
export function excelSerial(d: Date): number {
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86_400_000)
}
export function fromExcelSerial(n: number): Date {
  return new Date(1899, 11, 30 + Math.floor(n))
}

export async function writeXlsx(sheets: OutSheet[]): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
  )
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  )
  // styles: 0 default, 1 header (bold, grey fill), 2 date dd.mm.yyyy
  zip.file(
    'xl/styles.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd\\.mm\\.yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>',
  )
  sheets.forEach((s, i) => {
    const cell = (v: OutCell, c: number, r: number, header = false): string => {
      const ref = `${colName(c)}${r}`
      if (v === null || v === undefined || v === '') return ''
      if (header) return `<c r="${ref}" s="1" t="inlineStr"><is><t>${esc(String(v))}</t></is></c>`
      if (v instanceof Date) return `<c r="${ref}" s="2"><v>${excelSerial(v)}</v></c>`
      if (typeof v === 'number') return Number.isFinite(v) ? `<c r="${ref}"><v>${v}</v></c>` : ''
      if (typeof v === 'boolean') return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`
    }
    const rows = [s.headers, ...s.rows]
    const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => cell(v, ci, ri + 1, ri === 0)).join('')}</row>`).join('')
    const widths = s.headers.map((h, ci) => s.widths?.[ci] ?? Math.min(60, Math.max(10, h.length + 4)))
    zip.file(
      `xl/worksheets/sheet${i + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, ci) => `<col min="${ci + 1}" max="${ci + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData>${s.headers.length ? `<autoFilter ref="A1:${colName(s.headers.length - 1)}${Math.max(1, rows.length)}"/>` : ''}</worksheet>`,
    )
  })
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}
