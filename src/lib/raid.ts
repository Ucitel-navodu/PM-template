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
