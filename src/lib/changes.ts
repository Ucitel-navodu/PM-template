import type { ChangeRequest } from '../types'

const COUNTS = new Set(['Approved', 'Implemented', 'Closed'])

/** Approved (or later implemented/closed) change requests count towards the current baseline of scope, time and cost. */
export const isApproved = (c: ChangeRequest) => COUNTS.has(c.status)

export function approvedImpact(changes: ChangeRequest[] = []): { days: number; cost: number } {
  return changes.filter(isApproved).reduce((a, c) => ({ days: a.days + (c.impactDays || 0), cost: a.cost + (c.impactCost || 0) }), { days: 0, cost: 0 })
}

type Sums = { planned: number; committed: number; actual: number; forecast: number }

/** Budget totals split into CAPEX, OPEX and not yet classified items. */
export function budgetByCostType(budget: { costType?: 'CAPEX' | 'OPEX'; planned: number; committed: number; actual: number }[]): Record<'CAPEX' | 'OPEX' | 'none', Sums> {
  const out = { CAPEX: zero(), OPEX: zero(), none: zero() }
  for (const b of budget) {
    const s = out[b.costType ?? 'none']
    s.planned += b.planned
    s.committed += b.committed
    s.actual += b.actual
    s.forecast += Math.max(b.planned, b.committed, b.actual)
  }
  return out
}
const zero = (): Sums => ({ planned: 0, committed: 0, actual: 0, forecast: 0 })
