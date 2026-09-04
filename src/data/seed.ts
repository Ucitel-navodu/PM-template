import type { BudgetItem, Milestone, ProjectInfo, Risk, Task } from '../types'

// Seed data adapted from "Project_Manager_Template_VBA_v18.xlsm" (sheets TASKS,
// MILESTONES, BUDGET, RISKS, DASHBOARD). Dates and amounts follow the original
// sample project; a few milestones/budget links were filled in for the demo
// since the source workbook only had 2 of 5 referenced milestones populated.

export const projectInfo: ProjectInfo = {
  projectId: 'TMS-2026',
  projectName: 'TMS program',
  businessOwner: 'Mariusz Pniewski',
  bpm: 'Petr Procházka',
  itpm: 'Vlastimil Šitina',
  start: '2025-06-01',
  plannedFinish: '2026-07-27',
  budget: 45_000_000,
  currency: 'CZK',
}

export const seedTasks: Task[] = [
  { id: 't1', wbs: '1', externalId: 'MSP-ID-65', name: 'Preparation of RFI documents', phase: 'INITIATION', status: 'Done', owner: 'S. Glabinski', currentStart: '2025-08-29', currentFinish: '2025-10-03', baselineFinish: '2025-10-03', percentComplete: 1, predecessors: '', milestone: false, priority: 'Medium', mgmtExport: true, mgmtOrder: 1 },
  { id: 't2', wbs: '2', externalId: 'MSP-ID-66', name: 'RFI launch', phase: 'INITIATION', status: 'Done', owner: 'S. Glabinski', currentStart: '2025-10-03', currentFinish: '2025-10-10', baselineFinish: '2025-10-10', percentComplete: 1, predecessors: 't1', milestone: false, priority: 'Medium', mgmtExport: true, mgmtOrder: 2 },
  { id: 't3', wbs: '3', externalId: 'MSP-ID-67', name: 'RFI bids submission period', phase: 'INITIATION', status: 'Done', owner: 'S. Glabinski', currentStart: '2025-10-10', currentFinish: '2025-10-31', baselineFinish: '2025-10-31', percentComplete: 1, predecessors: 't2', milestone: false, priority: 'Medium', mgmtExport: true, mgmtOrder: 3 },
  { id: 't4', wbs: '4', externalId: 'MSP-ID-70', name: 'Preparation of RFP documents', phase: 'PLANNING', status: 'Done', owner: 'S. Glabinski', currentStart: '2025-11-01', currentFinish: '2026-01-12', baselineFinish: '2026-01-12', percentComplete: 1, predecessors: 't3', milestone: false, priority: 'Medium', mgmtExport: true, mgmtOrder: 4 },
  { id: 't5', wbs: '5', externalId: 'MSP-ID-71', name: 'Tender bids submission period 1st round', phase: 'PLANNING', status: 'Done', owner: 'S. Glabinski', currentStart: '2026-01-14', currentFinish: '2026-02-20', baselineFinish: '2026-02-20', percentComplete: 1, predecessors: 't4', milestone: false, priority: 'Medium', mgmtExport: true, mgmtOrder: 5 },
  { id: 't6', wbs: '6', externalId: 'MSP-ID-72', name: 'SteCo', phase: 'PLANNING', status: 'Done', owner: 'M. Pniewski', currentStart: '2026-03-06', currentFinish: '2026-03-06', baselineFinish: '2026-03-06', percentComplete: 1, predecessors: 't5', milestone: false, priority: 'Medium', mgmtExport: true, mgmtOrder: 6 },
  { id: 't7', wbs: '7', externalId: 'MSP-ID-71b', name: 'Preparation of RFP documents (round 2)', phase: 'PLANNING', status: 'Done', owner: 'S. Glabinski', currentStart: '2026-03-07', currentFinish: '2026-06-19', baselineFinish: '2026-06-19', percentComplete: 1, predecessors: 't6', milestone: false, priority: 'Medium', mgmtExport: true, mgmtOrder: 7 },
  { id: 't8', wbs: '8', externalId: 'MSP-ID-71c', name: 'Tender bids submission period 2nd round', phase: 'PLANNING', status: 'Done', owner: 'S. Glabinski', currentStart: '2026-06-22', currentFinish: '2026-07-31', baselineFinish: '2026-08-07', percentComplete: 1, predecessors: 't7', milestone: false, priority: 'Medium', mgmtExport: true, mgmtOrder: 8 },
  { id: 't9', wbs: '9', externalId: 'MSP-ID-72b', name: 'Clarification rounds with suppliers', phase: 'PLANNING', status: 'Done', owner: 'S. Glabinski', currentStart: '2026-07-06', currentFinish: '2026-08-07', baselineFinish: '2026-08-07', percentComplete: 1, predecessors: 't8', milestone: false, priority: 'Medium', mgmtExport: true, mgmtOrder: 9 },
  { id: 't10', wbs: '10', externalId: 'MSP-ID-73', name: 'Tender bids evaluation', phase: 'PLANNING', status: 'In progress', owner: 'P. Procházka', currentStart: '2026-08-10', currentFinish: '2026-09-07', baselineFinish: '2026-09-07', percentComplete: 0.35, predecessors: 't9', milestone: false, priority: 'Very High', mgmtExport: true, mgmtOrder: 10 },
  { id: 't11', wbs: '11', externalId: 'MSP-ID-74', name: 'Decision', phase: 'PLANNING', status: 'Not started', owner: 'M. Pniewski', currentStart: '2026-09-07', currentFinish: '2026-09-21', baselineFinish: '2026-09-21', percentComplete: 0, predecessors: 't10', milestone: false, priority: 'Medium', mgmtExport: true, mgmtOrder: 11 },
  { id: 't12', wbs: '12', externalId: 'MSP-ID-75', name: 'Contract negotiations + signing', phase: 'PLANNING', status: 'Not started', owner: 'P. Procházka', currentStart: '2026-09-21', currentFinish: '2026-12-14', baselineFinish: '2026-12-14', percentComplete: 0, predecessors: 't11', milestone: false, priority: 'Very High', mgmtExport: true, mgmtOrder: 12 },
  { id: 't13', wbs: '13', externalId: 'MSP-ID-76', name: 'Contract sign-off', phase: 'PLANNING', status: 'Not started', owner: 'M. Pniewski', currentStart: '2026-12-14', currentFinish: '2026-12-14', baselineFinish: '2026-12-14', percentComplete: 0, predecessors: 't12', milestone: true, priority: 'Very High', mgmtExport: true, mgmtOrder: 13 },
  { id: 't14', wbs: '14', externalId: 'MSP-ID-92', name: 'KoM (Kick-off Meeting)', phase: 'REALIZATION', status: 'Not started', owner: 'V. Šitina', currentStart: '2027-01-04', currentFinish: '2027-01-04', baselineFinish: '2027-01-04', percentComplete: 0, predecessors: 't13', milestone: true, priority: 'Very High', mgmtExport: true, mgmtOrder: 14 },
  { id: 't15', wbs: '15', externalId: 'MSP-ID-92b', name: 'Implementation rounds', phase: 'REALIZATION', status: 'Not started', owner: 'V. Šitina', currentStart: '2027-01-04', currentFinish: '2027-10-31', baselineFinish: '2027-10-31', percentComplete: 0, predecessors: 't14', milestone: false, priority: 'Very High', mgmtExport: true, mgmtOrder: 15 },
  { id: 't16', wbs: '16', externalId: 'MSP-ID-94', name: 'Testing and User Training', phase: 'REALIZATION', status: 'Not started', owner: 'V. Šitina', currentStart: '2027-10-31', currentFinish: '2028-01-29', baselineFinish: '2028-01-29', percentComplete: 0, predecessors: 't15', milestone: false, priority: 'Very High', mgmtExport: true, mgmtOrder: 16 },
  { id: 't17', wbs: '17', externalId: 'MSP-ID-95', name: 'GO LIVE', phase: 'CLOSING', status: 'Not started', owner: 'V. Šitina', currentStart: '2028-01-29', currentFinish: '2028-01-29', baselineFinish: '2028-01-29', percentComplete: 0, predecessors: 't16', milestone: true, priority: 'Very High', mgmtExport: true, mgmtOrder: 17 },
]

export const seedMilestones: Milestone[] = [
  { id: 'M01', linkedTaskId: 't1', name: 'Kick-off / project start', plannedDate: '2026-07-10', paymentTriggerPct: 0.1, paymentAmount: 100_000, paymentStatus: 'Paid' },
  { id: 'M02', linkedTaskId: 't10', name: 'Functional specification accepted', plannedDate: '2026-08-20', paymentTriggerPct: 0.3, paymentAmount: 300_000, paymentStatus: 'Invoiced' },
  { id: 'M03', linkedTaskId: 't13', name: 'Delivery / configuration', plannedDate: '2026-10-20', paymentTriggerPct: 0.3, paymentAmount: 300_000, paymentStatus: 'Not due' },
  { id: 'M04', linkedTaskId: 't14', name: 'Commissioning (KoM)', plannedDate: '2026-12-20', paymentTriggerPct: 0.2, paymentAmount: 200_000, paymentStatus: 'Not due' },
  { id: 'M05', linkedTaskId: 't17', name: 'SAT acceptance / GO LIVE', plannedDate: '2027-04-05', paymentTriggerPct: 0.1, paymentAmount: 100_000, paymentStatus: 'Not due' },
]

export const seedBudget: BudgetItem[] = [
  { id: 'B001', category: 'Services', supplier: 'Vendor', description: 'Kick-off / project start', linkedMilestoneId: 'M01', planned: 100_000, committed: 100_000, actual: 100_000, dueDate: '2026-07-10', paymentStatus: 'Invoiced' },
  { id: 'B002', category: 'Services', supplier: 'Vendor', description: 'Requirements / analysis', planned: 50_000, committed: 0, actual: 0, dueDate: '2026-07-31', paymentStatus: 'Not due' },
  { id: 'B003', category: 'Services', supplier: 'Vendor', description: 'Functional specification', linkedMilestoneId: 'M02', planned: 300_000, committed: 300_000, actual: 150_000, dueDate: '2026-08-20', paymentStatus: 'Not due' },
  { id: 'B004', category: 'HW/SW', supplier: 'Supplier', description: 'Procurement / HW-SW', planned: 150_000, committed: 0, actual: 0, dueDate: '2026-08-31', paymentStatus: 'Not due' },
  { id: 'B005', category: 'License', supplier: 'Vendor', description: 'Delivery / configuration', linkedMilestoneId: 'M03', planned: 300_000, committed: 300_000, actual: 0, dueDate: '2026-10-20', paymentStatus: 'Not due' },
  { id: 'B006', category: 'Services', supplier: 'Vendor', description: 'Testing / FAT', planned: 75_000, committed: 0, actual: 0, dueDate: '2026-11-20', paymentStatus: 'Not due' },
  { id: 'B007', category: 'Services', supplier: 'Vendor', description: 'Commissioning', linkedMilestoneId: 'M04', planned: 200_000, committed: 200_000, actual: 0, dueDate: '2026-12-20', paymentStatus: 'Not due' },
  { id: 'B008', category: 'Services', supplier: 'Vendor', description: 'Stabilization support', planned: 50_000, committed: 0, actual: 0, dueDate: '2027-02-28', paymentStatus: 'Not due' },
  { id: 'B009', category: 'Services', supplier: 'Vendor', description: 'SAT acceptance', linkedMilestoneId: 'M05', planned: 100_000, committed: 100_000, actual: 0, dueDate: '2027-04-05', paymentStatus: 'Not due' },
  { id: 'B010', category: 'Contingency', supplier: '', description: 'Management reserve', planned: 0, committed: 0, actual: 0, dueDate: '2027-03-31', paymentStatus: 'Not due', notes: 'Doplň podle schválené rezervy' },
]

export const seedRisks: Risk[] = [
  { id: 'R-001', type: 'Risk', area: 'Axigon', description: 'Dodavatel nepotvrdí požadovaný rozsah / předplatbu.', probability: 'Medium', impact: 'High', owner: 'S. Glabinski', mitigation: 'Zapojit management a potvrdit scope na workshopu.', dueDate: '2026-06-30', status: 'Open', lastUpdate: '2026-06-15', comment: 'Vzorový záznam' },
]
