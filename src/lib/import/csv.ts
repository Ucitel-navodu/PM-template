/** A table read from CSV or from an Excel sheet. Cells are strings or numbers (Excel dates arrive as serial numbers). */
export type Cell = string | number | null
export interface Table {
  name: string
  headers: string[]
  rows: Cell[][]
}

/** Decode file bytes: UTF-8 (with or without BOM), falling back to Windows-1250 (Czech Excel "CSV"). */
export function decodeText(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('windows-1250').decode(bytes)
  }
}

export function detectDelimiter(text: string): string {
  const head = text.split(/\r?\n/).slice(0, 5).join('\n')
  const count = (d: string) => (head.match(new RegExp(d === '\t' ? '\t' : `\\${d}`, 'g')) ?? []).length
  return [';', ',', '\t'].map((d) => [d, count(d)] as const).sort((a, b) => b[1] - a[1])[0][0]
}

/** RFC 4180 parser: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"', i++)
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === delimiter) (row.push(field), (field = ''))
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) (row.push(field), rows.push(row))
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export function csvToTable(text: string, name = 'CSV'): Table {
  const [headers = [], ...rows] = parseCsv(text)
  return { name, headers: headers.map((h) => h.trim()), rows }
}
