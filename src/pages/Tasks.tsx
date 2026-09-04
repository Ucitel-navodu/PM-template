import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { computeHealth } from '../lib/health'
import { HealthBadge } from '../components/HealthBadge'
import { formatPercent } from '../lib/format'
import { downloadCsv } from '../lib/csv'
import { PHASES, PRIORITIES, STATUSES, STATUS_ICON } from '../data/config'
import { btnPrimary, btnSecondary, deleteBtn, inputGhost, selectFilter, selectGhost, tableWrap, tbodyRow, theadRow } from '../lib/ui'
import type { Task } from '../types'

let nextId = 1000

function blankTask(): Task {
  nextId += 1
  return {
    id: `t${nextId}`,
    wbs: '',
    name: '',
    phase: 'INITIATION',
    status: 'Not started',
    owner: '',
    percentComplete: 0,
    milestone: false,
    priority: 'Medium',
    mgmtExport: false,
  }
}

export function TasksPage() {
  const { tr, tasks, addTask, updateTask, deleteTask } = useApp()
  const [phaseFilter, setPhaseFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (phaseFilter === 'all' || task.phase === phaseFilter) &&
          (statusFilter === 'all' || task.status === statusFilter),
      ),
    [tasks, phaseFilter, statusFilter],
  )

  const exportCsv = () => {
    downloadCsv(
      'tasks.csv',
      filtered.map((task) => ({
        WBS: task.wbs,
        Name: task.name,
        Phase: task.phase,
        Status: task.status,
        Owner: task.owner,
        CurrentStart: task.currentStart ?? '',
        CurrentFinish: task.currentFinish ?? '',
        PercentComplete: task.percentComplete ?? '',
        Priority: task.priority,
        Health: computeHealth(task),
      })),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} className={selectFilter}>
            <option value="all">{tr('tasks_filter_all')} — {tr('tasks_phase')}</option>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectFilter}>
            <option value="all">{tr('tasks_filter_all')} — {tr('common_status')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className={btnSecondary}>
            {tr('tasks_export_csv')}
          </button>
          <button onClick={() => addTask(blankTask())} className={btnPrimary}>
            {tr('tasks_add')}
          </button>
        </div>
      </div>

      <div className={tableWrap}>
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className={theadRow}>
              <th className="px-3 py-2">WBS</th>
              <th className="px-3 py-2">{tr('tasks_task_name')}</th>
              <th className="px-3 py-2">{tr('tasks_phase')}</th>
              <th className="px-3 py-2">{tr('common_status')}</th>
              <th className="px-3 py-2">{tr('common_owner')}</th>
              <th className="px-3 py-2">{tr('tasks_current_start')}</th>
              <th className="px-3 py-2">{tr('tasks_current_finish')}</th>
              <th className="px-3 py-2">{tr('tasks_percent_complete')}</th>
              <th className="px-3 py-2">{tr('tasks_critical')}</th>
              <th className="px-3 py-2">{tr('gantt_milestone')}</th>
              <th className="px-3 py-2">{tr('common_health')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((task) => {
              const health = computeHealth(task)
              return (
                <tr key={task.id} className={tbodyRow}>
                  <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{task.wbs}</td>
                  <td className="px-3 py-1.5">
                    <input
                      value={task.name}
                      onChange={(e) => updateTask(task.id, { name: e.target.value })}
                      className={`w-56 ${inputGhost}`}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={task.phase}
                      onChange={(e) => updateTask(task.id, { phase: e.target.value as Task['phase'] })}
                      className={selectGhost}
                    >
                      {PHASES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={task.status}
                      onChange={(e) => updateTask(task.id, { status: e.target.value as Task['status'] })}
                      className={selectGhost}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_ICON[s]} {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      value={task.owner}
                      onChange={(e) => updateTask(task.id, { owner: e.target.value })}
                      className={`w-28 ${inputGhost}`}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="date"
                      value={task.currentStart ?? ''}
                      onChange={(e) => updateTask(task.id, { currentStart: e.target.value || undefined })}
                      className={selectGhost}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="date"
                      value={task.currentFinish ?? ''}
                      onChange={(e) => updateTask(task.id, { currentFinish: e.target.value || undefined })}
                      className={selectGhost}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={task.percentComplete == null ? '' : Math.round(task.percentComplete * 100)}
                      onChange={(e) =>
                        updateTask(task.id, {
                          percentComplete: e.target.value === '' ? null : Number(e.target.value) / 100,
                        })
                      }
                      className={`w-16 ${inputGhost}`}
                    />
                    <span className="text-xs text-gray-400 dark:text-gray-500"> {formatPercent(task.percentComplete)}</span>
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={task.priority}
                      onChange={(e) => updateTask(task.id, { priority: e.target.value as Task['priority'] })}
                      className={selectGhost}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={task.milestone}
                      onChange={(e) => updateTask(task.id, { milestone: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <HealthBadge health={health} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button onClick={() => deleteTask(task.id)} className={deleteBtn} title={tr('tasks_delete')}>
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
