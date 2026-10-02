import type { BudgetItem, Milestone, ProjectInfo, Risk, Task } from '../types'

// Portable project snapshot: lets a PM carry their data between PCs/browsers,
// since the app itself only persists to localStorage on the device it runs on.
const PROJECT_FILE_VERSION = 1

export interface ProjectBundle {
  fileType: 'pm-web-project'
  version: number
  exportedAt: string
  projectInfo: ProjectInfo
  tasks: Task[]
  milestones: Milestone[]
  budget: BudgetItem[]
  risks: Risk[]
}

export function buildProjectBundle(data: {
  projectInfo: ProjectInfo
  tasks: Task[]
  milestones: Milestone[]
  budget: BudgetItem[]
  risks: Risk[]
}): ProjectBundle {
  return {
    fileType: 'pm-web-project',
    version: PROJECT_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    ...data,
  }
}

function sanitizeFilename(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]+/g, '-')
  return cleaned || 'projekt'
}

export function downloadProjectFile(bundle: ProjectBundle): void {
  const json = JSON.stringify(bundle, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const dateStamp = bundle.exportedAt.slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(bundle.projectInfo.projectName)}_${dateStamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export class ProjectFileError extends Error {}

export function parseProjectFile(text: string): ProjectBundle {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ProjectFileError('Soubor není platný JSON.')
  }
  if (typeof data !== 'object' || data === null) {
    throw new ProjectFileError('Soubor neobsahuje platná data projektu.')
  }
  const bundle = data as Partial<ProjectBundle>
  if (bundle.fileType !== 'pm-web-project') {
    throw new ProjectFileError('Tento soubor nevypadá jako export z této aplikace.')
  }
  if (!bundle.projectInfo || !Array.isArray(bundle.tasks)) {
    throw new ProjectFileError('Soubor chybí klíčová data (projectInfo/tasks).')
  }
  return {
    fileType: 'pm-web-project',
    version: bundle.version ?? PROJECT_FILE_VERSION,
    exportedAt: bundle.exportedAt ?? new Date().toISOString(),
    projectInfo: bundle.projectInfo,
    tasks: bundle.tasks,
    milestones: Array.isArray(bundle.milestones) ? bundle.milestones : [],
    budget: Array.isArray(bundle.budget) ? bundle.budget : [],
    risks: Array.isArray(bundle.risks) ? bundle.risks : [],
  }
}

export function readProjectFile(file: File): Promise<ProjectBundle> {
  return file.text().then(parseProjectFile)
}
