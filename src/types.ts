/** The six fixed status meanings the Health formula and the scheduler understand.
 *  User-defined statuses (Settings) each map to one of them. */
export type Status =
  | 'Not started'
  | 'In progress'
  | 'On hold'
  | 'Delayed'
  | 'Cancelled'
  | 'Done'

export type Health = 'Green' | 'Orange' | 'Red' | 'Grey' | 'Blue'

export type Priority = string

export interface StatusDef {
  name: string
  kind: Status
}

// Phases are user-defined in Settings (CONFIG sheet equivalent).
export type Phase = string

export type LinkType = 'FS' | 'SS' | 'FF' | 'SF'

/** Predecessor link as in MS Project: type + lag in working days (negative = lead). */
export interface Dependency {
  predId: string
  type: LinkType
  lag: number
}

/** SNET = start no earlier than, MSO = must start on (MS Project constraint types). */
export interface TaskConstraint {
  type: 'SNET' | 'MSO'
  date: string
}

export type SchedulingMode = 'auto' | 'manual'

export interface Task {
  id: string
  // Stable task number within the project (like the ID/UID in MS Project);
  // predecessors are written using it, e.g. "3FS+2d".
  no: number
  // Outline level (1 = top). The task list is kept in outline order, so the
  // parent of a task is the nearest previous task with a lower level - the
  // same model MS Project uses.
  outlineLevel: number
  // Outline number (1, 1.2, 1.2.1); derived from the hierarchy.
  wbs: string
  projectArea?: string
  externalId?: string
  // MS Project UID: key of the repeated import
  uid?: string
  name: string
  phase: Phase
  release?: string
  // Name of a status from the project's list (see StatusDef)
  status: string
  owner: string
  notes?: string
  baselineStart?: string
  baselineFinish?: string
  currentStart?: string
  currentFinish?: string
  percentComplete: number | null
  schedulingMode: SchedulingMode
  // Working days; 0 = milestone. Derived from the dates for manual tasks.
  duration?: number
  dependencies: Dependency[]
  constraint?: TaskConstraint
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

// RAID log: Risks, Assumptions, Issues, Dependencies + Decisions
export type RiskType = 'Risk' | 'Issue' | 'Assumption' | 'Dependency' | 'Decision'
export type RiskResponse = 'Avoid' | 'Mitigate' | 'Transfer' | 'Accept'
export type RiskStatus = 'Open' | 'Mitigated' | 'Closed' | 'Accepted' | 'Cancelled'
export type ImpactLevel = 'Low' | 'Medium' | 'High' | 'Critical'

export interface Risk {
  id: string
  type: RiskType
  title?: string
  area: string
  linkedTaskId?: string
  linkedChangeId?: string
  description: string
  probability: ImpactLevel
  impact: ImpactLevel
  owner: string
  mitigation: string
  dueDate?: string
  status: RiskStatus
  lastUpdate?: string
  comment?: string
  // risk
  response?: RiskResponse
  contingency?: string
  trigger?: string
  // issue
  priority?: string
  resolution?: string
  // assumption
  validated?: boolean
  // decision
  decidedBy?: string
  decisionDate?: string
  rationale?: string
}

export type ChangeType = 'Scope' | 'Time' | 'Budget' | 'Risk' | 'Decision'
export type ChangeStatus = 'Open' | 'Approved' | 'Rejected' | 'Implemented' | 'Closed'

export interface ChangeRequest {
  id: string
  title: string
  description: string
  type: ChangeType
  status: ChangeStatus
  requestedBy: string
  raised: string
  // Impact on the schedule in working days and on the budget (project currency)
  impactDays: number
  impactCost: number
  decidedBy?: string
  decisionDate?: string
  linkedTaskIds: string[]
  notes?: string
}

export type AuditEntity = 'task' | 'milestone' | 'budget' | 'raid' | 'change' | 'project' | 'lists'

export interface AuditEntry {
  at: string
  user: string
  entity: AuditEntity
  entityId: string
  label: string
  action: 'create' | 'update' | 'delete'
  field?: string
  old?: string
  new?: string
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

// Lists are per project (each project has its own phases etc.).
export interface ProjectLists {
  phases: string[]
  projectAreas: string[]
  budgetCategories: string[]
  statuses: StatusDef[]
  priorities: string[]
}

// Calendar and Health tolerances are shared by the whole workspace (portfolio).
export interface CalendarSettings {
  holidays: Holiday[]
  // 0 = Sunday ... 6 = Saturday (JS Date.getDay convention)
  workingDays: number[]
  orangeTolerance: number
  redTolerance: number
}

// Merged view used by pages: workspace calendar + active project's lists.
export type Settings = ProjectLists & CalendarSettings

export type AbsenceType = 'Vacation' | 'Business trip' | 'Other'

export interface Absence {
  id: string
  person: string
  type: AbsenceType
  from: string
  to: string
  note?: string
}

export interface Baseline {
  id: string
  name: string
  createdAt: string
  tasks: Record<string, { start?: string; finish?: string }>
}

export interface TaskView {
  id: string
  name: string
  filters: Record<string, string>
  hiddenColumns: string[]
  sort?: { id: string; desc: boolean }
}

export type Rag = 'Green' | 'Amber' | 'Red'

/** A saved status report (history for trend and audit). */
export interface StatusReport {
  id: string
  date: string
  periodFrom: string
  periodTo: string
  rag: Rag
  ragAuto: Rag | 'Grey'
  ragComment?: string
  summary: string
  achievements: string
  nextSteps: string
  escalations: string
  createdBy: string
  createdAt: string
}

export interface ImportRecord {
  id: string
  at: string
  user: string
  source: 'msp' | 'excel' | 'csv'
  fileName: string
  added: number
  updated: number
  removed: number
  unchanged: number
}

/** Branding of printed and PowerPoint reports (shared by the whole workspace). */
export interface ReportSettings {
  organization: string
  accentColor: string
  logoDataUrl?: string
  footer: string
}

export interface Project {
  id: string
  info: ProjectInfo
  lists: ProjectLists
  tasks: Task[]
  baselines: Baseline[]
  views: TaskView[]
  changes: ChangeRequest[]
  auditLog: AuditEntry[]
  statusReports: StatusReport[]
  importLog: ImportRecord[]
  milestones: Milestone[]
  budget: BudgetItem[]
  risks: Risk[]
  archived?: boolean
  createdAt: string
  updatedAt: string
}

export const WORKSPACE_SCHEMA_VERSION = 7

export interface Workspace {
  fileType: 'pm-web-workspace'
  schemaVersion: number
  id: string
  // Incremented on every save to the workspace file; used to detect that
  // somebody else saved the same file in the meantime.
  revision: number
  savedAt?: string
  savedBy?: string
  calendar: CalendarSettings
  absences: Absence[]
  reportSettings: ReportSettings
  projects: Project[]
}
