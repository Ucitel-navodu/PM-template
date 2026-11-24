import type { ImpactLevel, Risk } from '../types'

export const IMPACT_LEVELS_DESC: ImpactLevel[] = ['Critical', 'High', 'Medium', 'Low']
export const LEVEL_SCORE: Record<ImpactLevel, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 }

/** Probability x Impact (1..16), the workbook's ProbabilityImpact matrix. Only risks and issues are scored. */
export function riskScore(r: Pick<Risk, 'probability' | 'impact'>): number {
  return (LEVEL_SCORE[r.probability] ?? 0) * (LEVEL_SCORE[r.impact] ?? 0)
}

export const isScored = (r: Pick<Risk, 'type'>) => (r.type ?? 'Risk') === 'Risk' || r.type === 'Issue'

/** Heat colour: >= 9 high (red), >= 4 medium (amber), else low (green). */
export function scoreClass(score: number): string {
  if (score >= 9) return 'bg-rose-500 text-white'
  if (score >= 4) return 'bg-amber-400 text-gray-900'
  return 'bg-emerald-500 text-white'
}

/** Open risks and issues per cell of the P x I map: counts[probability][impact]. */
export function riskMatrix(risks: Risk[]): Record<ImpactLevel, Record<ImpactLevel, number>> {
  const zero = (): Record<ImpactLevel, number> => ({ Low: 0, Medium: 0, High: 0, Critical: 0 })
  const m = { Low: zero(), Medium: zero(), High: zero(), Critical: zero() }
  for (const r of risks) if (r.status === 'Open' && isScored(r) && m[r.probability] && r.impact in m[r.probability]) m[r.probability][r.impact]++
  return m
}

/** Heat colour of a score as hex fills for PowerPoint (brand: red / supplementary yellow / green). */
export function scoreFill(score: number): { fill: string; text: string } {
  if (score >= 9) return { fill: 'D81E04', text: 'FFFFFF' }
  if (score >= 4) return { fill: 'FBBA00', text: '2B3035' }
  return { fill: '689425', text: 'FFFFFF' }
}
