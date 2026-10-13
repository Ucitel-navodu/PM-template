import type { Milestone } from '../types'

export function milestoneAmount(m: Milestone, approvedBudget: number): number {
  return Math.round((m.paymentTriggerPct || 0) * approvedBudget)
}

// Planned vs. baseline in days, like the MILESTONES "Variance d" column.
export function milestoneVarianceDays(m: Milestone): number | null {
  if (!m.plannedDate || !m.baselineDate) return null
  return Math.round((new Date(m.plannedDate).getTime() - new Date(m.baselineDate).getTime()) / 86_400_000)
}
