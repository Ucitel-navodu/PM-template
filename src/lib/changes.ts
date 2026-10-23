import type { ChangeRequest } from '../types'

const COUNTS = new Set(['Approved', 'Implemented', 'Closed'])

/** Approved (or later implemented/closed) change requests count towards the current baseline of scope, time and cost. */
export const isApproved = (c: ChangeRequest) => COUNTS.has(c.status)

export function approvedImpact(changes: ChangeRequest[] = []): { days: number; cost: number } {
  return changes.filter(isApproved).reduce((a, c) => ({ days: a.days + (c.impactDays || 0), cost: a.cost + (c.impactCost || 0) }), { days: 0, cost: 0 })
}
