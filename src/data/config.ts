import type { BudgetCategory, Health, ImpactLevel, PaymentStatus, Phase, Priority, RiskStatus, Status } from '../types'

export const STATUSES: Status[] = ['Not started', 'In progress', 'On hold', 'Delayed', 'Cancelled', 'Done']

export const STATUS_ICON: Record<Status, string> = {
  'Not started': '🚩',
  'In progress': '📈',
  'On hold': '⏸️',
  'Delayed': '⛔',
  'Cancelled': '❌',
  'Done': '✔️',
}

export const PHASES: Phase[] = ['INITIATION', 'PLANNING', 'REALIZATION', 'CLOSING']

export const PRIORITIES: Priority[] = ['Very High', 'High', 'Medium', 'Low', 'Very Low', 'On Hold']

export const PAYMENT_STATUSES: PaymentStatus[] = ['Not due', 'Invoiced', 'Paid', 'Overdue', 'Cancelled']

export const BUDGET_CATEGORIES: BudgetCategory[] = [
  'License',
  'HW/SW',
  'Services',
  'Development',
  'Implementation',
  'Contingency',
  'Other',
]

export const RISK_STATUSES: RiskStatus[] = ['Open', 'Mitigated', 'Closed', 'Accepted', 'Cancelled']

export const IMPACT_LEVELS: ImpactLevel[] = ['Low', 'Medium', 'High', 'Critical']

export const HEALTH_COLOR: Record<Health, string> = {
  Green: '#2e7d32',
  Orange: '#e08a00',
  Red: '#c62828',
  Grey: '#8a8f98',
  Blue: '#2962ff',
}

export const HEALTH_BG: Record<Health, string> = {
  Green: '#e8f5e9',
  Orange: '#fff3e0',
  Red: '#ffebee',
  Grey: '#f1f2f4',
  Blue: '#e3edff',
}
