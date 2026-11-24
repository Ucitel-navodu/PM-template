import type { ChangeStatus, ChangeType, Health, ImpactLevel, PaymentStatus, RiskResponse, RiskStatus, RiskType, Status } from '../types'


export const STATUS_ICON: Record<Status, string> = {
  'Not started': '🚩',
  'In progress': '📈',
  'On hold': '⏸️',
  'Delayed': '⛔',
  'Cancelled': '❌',
  'Done': '✔️',
}



export const PAYMENT_STATUSES: PaymentStatus[] = ['Not due', 'Invoiced', 'Paid', 'Overdue', 'Cancelled']


export const RISK_TYPES: RiskType[] = ['Risk', 'Issue', 'Assumption', 'Dependency', 'Decision']
export const RISK_RESPONSES: RiskResponse[] = ['Avoid', 'Mitigate', 'Transfer', 'Accept']
// Change request types and states from the workbook's CONFIG sheet
export const CHANGE_TYPES: ChangeType[] = ['Scope', 'Time', 'Budget', 'Risk', 'Decision']
export const CHANGE_STATUSES: ChangeStatus[] = ['Open', 'Approved', 'Rejected', 'Implemented', 'Closed']

export const RISK_STATUSES: RiskStatus[] = ['Open', 'Mitigated', 'Closed', 'Accepted', 'Cancelled']

export const IMPACT_LEVELS: ImpactLevel[] = ['Low', 'Medium', 'High', 'Critical']

// Health colours from the supplementary colours of the ORLEN Unipetrol manual (4.2);
// red is the brand red. Fills (bars, dots) use HEALTH_COLOR, text uses HEALTH_TEXT (>= 4.5 : 1).
export const HEALTH_COLOR: Record<Health, string> = {
  Green: '#689425',
  Orange: '#fbba00',
  Red: '#d81e04',
  Grey: '#90a3b2',
  Blue: '#00779c',
}

export const HEALTH_TEXT: Record<Health, string> = {
  Green: '#456319',
  Orange: '#7d5700',
  Red: '#a11603',
  Grey: '#465767',
  Blue: '#005f7d',
}

export const HEALTH_BG: Record<Health, string> = {
  Green: '#f1f6ea',
  Orange: '#fff8e1',
  Red: '#fdf0ee',
  Grey: '#f3f6f8',
  Blue: '#e6f6fd',
}

export const HEALTH_COLOR_DARK: Record<Health, string> = {
  Green: '#a5c46f',
  Orange: '#fdcf4d',
  Red: '#ff8a78',
  Grey: '#adbdc9',
  Blue: '#4cc4ef',
}

export const HEALTH_BG_DARK: Record<Health, string> = {
  Green: 'rgba(104, 148, 37, 0.24)',
  Orange: 'rgba(251, 186, 0, 0.2)',
  Red: 'rgba(216, 30, 4, 0.26)',
  Grey: 'rgba(144, 163, 178, 0.22)',
  Blue: 'rgba(0, 177, 235, 0.2)',
}
