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

export const HEALTH_COLOR_DARK: Record<Health, string> = {
  Green: '#6fcf7a',
  Orange: '#ffb74d',
  Red: '#ff6b6b',
  Grey: '#b5b9c2',
  Blue: '#7ea6ff',
}

export const HEALTH_BG_DARK: Record<Health, string> = {
  Green: 'rgba(46, 125, 50, 0.22)',
  Orange: 'rgba(224, 138, 0, 0.22)',
  Red: 'rgba(198, 40, 40, 0.24)',
  Grey: 'rgba(138, 143, 152, 0.22)',
  Blue: 'rgba(41, 98, 255, 0.22)',
}
