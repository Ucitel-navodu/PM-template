export type Status =
  | 'Not started'
  | 'In progress'
  | 'On hold'
  | 'Delayed'
  | 'Cancelled'
  | 'Done'

export type Health = 'Green' | 'Orange' | 'Red' | 'Grey' | 'Blue'

export type Priority = 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low' | 'On Hold'

// Phases are user-defined in Settings (CONFIG sheet equivalent).
export type Phase = string

export interface Task {
  id: string
  wbs: string
  projectArea?: string
  externalId?: string
  name: string
  phase: Phase
  release?: string
  status: Status
  owner: string
  notes?: string
  baselineStart?: string
  baselineFinish?: string
  currentStart?: string
  currentFinish?: string
  percentComplete: number | null
  predecessors?: string
  milestone: boolean
  priority: Priority
  lastImported?: string
  lastChanged?: string
  source?: string
  mgmtExport: boolean
  mgmtOrder?: number
}

export type PaymentStatus = 'Not due' | 'Invoiced' | 'Paid' | 'Overdue' | 'Cancelled'

export interface Milestone {
  id: string
  linkedTaskId?: string
  name: string
  plannedDate?: string
  baselineDate?: string
  actualDate?: string
  // Share of the approved budget paid at this milestone. The amount is derived
  // (budget x pct), as in the original MILESTONES sheet formula.
  paymentTriggerPct: number
  invoiceNo?: string
  paymentStatus: PaymentStatus
  notes?: string
}

export type BudgetCategory = string

export interface BudgetItem {
  id: string
  category: BudgetCategory
  supplier: string
  description: string
  linkedMilestoneId?: string
  planned: number
  committed: number
  actual: number
  dueDate?: string
  paymentStatus: PaymentStatus
  invoiceNo?: string
  notes?: string
}

export type RiskType = 'Risk' | 'Issue'
export type RiskStatus = 'Open' | 'Mitigated' | 'Closed' | 'Accepted' | 'Cancelled'
export type ImpactLevel = 'Low' | 'Medium' | 'High' | 'Critical'

export interface Risk {
  id: string
  type: RiskType
  area: string
  linkedTaskId?: string
  description: string
  probability: ImpactLevel
  impact: ImpactLevel
  owner: string
  mitigation: string
  dueDate?: string
  status: RiskStatus
  lastUpdate?: string
  comment?: string
}

export interface ProjectInfo {
  projectId: string
  projectName: string
  businessOwner: string
  bpm: string
  itpm: string
  start: string
  plannedFinish: string
  budget: number
  currency: string
}

export type Lang = 'CZ' | 'EN'

export type Theme = 'light' | 'dark'

export interface Holiday {
  date: string
  name: string
}

export interface Settings {
  phases: string[]
  projectAreas: string[]
  budgetCategories: string[]
  holidays: Holiday[]
  // 0 = Sunday ... 6 = Saturday (JS Date.getDay convention)
  workingDays: number[]
  orangeTolerance: number
  redTolerance: number
}

export type AbsenceType = 'Vacation' | 'Business trip' | 'Other'

export interface Absence {
  id: string
  person: string
  type: AbsenceType
  from: string
  to: string
  note?: string
}
