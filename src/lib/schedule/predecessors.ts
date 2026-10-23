import type { Dependency, LinkType, Task } from '../../types'

/*
 * Predecessor notation as in MS Project's Predecessors column:
 * "3; 5SS+2d; 7FF-1d" - task number, optional link type (FS default),
 * optional lag in working days (negative = lead).
 */

const TOKEN = /^(\d+)\s*(FS|SS|FF|SF)?\s*(?:([+-])\s*(\d+)\s*(?:d|dny|dní|den|days?|wd)?)?$/i

export function formatDependencies(deps: Dependency[], tasks: Task[]): string {
  const noById = new Map(tasks.map((t) => [t.id, t.no]))
  return deps
    .filter((d) => noById.has(d.predId))
    .map((d) => {
      const lag = d.lag ? `${d.lag > 0 ? '+' : '-'}${Math.abs(d.lag)}d` : ''
      const type = d.type !== 'FS' || lag ? d.type : ''
      return `${noById.get(d.predId)}${type}${lag}`
    })
    .join('; ')
}

export interface ParseResult {
  deps: Dependency[]
  errors: string[]
}

export function parseDependencies(text: string, tasks: Task[], selfId: string): ParseResult {
  const idByNo = new Map(tasks.map((t) => [t.no, t.id]))
  const deps: Dependency[] = []
  const errors: string[] = []
  for (const raw of text.split(/[;,]/)) {
    const token = raw.trim()
    if (!token) continue
    const m = TOKEN.exec(token)
    if (!m) {
      errors.push(token)
      continue
    }
    const predId = idByNo.get(Number(m[1]))
    if (!predId || predId === selfId) {
      errors.push(token)
      continue
    }
    const lag = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0
    const type = (m[2]?.toUpperCase() ?? 'FS') as LinkType
    if (!deps.some((d) => d.predId === predId)) deps.push({ predId, type, lag })
  }
  return { deps, errors }
}
