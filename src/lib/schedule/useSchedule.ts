import { useMemo } from 'react'
import { useActiveProject, useWorkspaceStore } from '../../store/workspaceStore'
import { schedule, type ScheduleResult } from './cpm'
import { outline, type OutlineInfo } from './tree'

export interface ProjectSchedule extends ScheduleResult {
  outline: Map<string, OutlineInfo>
}

const EMPTY: ProjectSchedule = { tasks: new Map(), cycle: [], outline: new Map() }

/** Float, critical path and outline of the active project (dates are already stored in the tasks). */
export function useSchedule(): ProjectSchedule {
  const project = useActiveProject()
  const calendar = useWorkspaceStore((s) => s.workspace.calendar)
  return useMemo(() => {
    if (!project) return EMPTY
    return { ...schedule(project.tasks, calendar, project.info.start || undefined, project.lists.statuses), outline: outline(project.tasks) }
  }, [project?.tasks, project?.info.start, project?.lists.statuses, calendar]) // eslint-disable-line react-hooks/exhaustive-deps
}
