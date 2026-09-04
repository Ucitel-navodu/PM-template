import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { computeHealth } from '../lib/health'
import { HealthBadge } from '../components/HealthBadge'
import { formatPercent } from '../lib/format'
import { downloadCsv } from '../lib/csv'
import { PHASES, PRIORITIES, STATUSES, STATUS_ICON } from '../data/config'
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
          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="all">{tr('tasks_filter_all')} — {tr('tasks_phase')}</option>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="all">{tr('tasks_filter_all')} — {tr('common_status')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            {tr('tasks_export_csv')}
          </button>
          <button
            onClick={() => addTask(blankTask())}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            {tr('tasks_add')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
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
                <tr key={task.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-1.5 text-gray-500">{task.wbs}</td>
                  <td className="px-3 py-1.5">
                    <input
                      value={task.name}
                      onChange={(e) => updateTask(task.id, { name: e.target.value })}
                      className="w-56 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-gray-200 focus:border-gray-300 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={task.phase}
                      onChange={(e) => updateTask(task.id, { phase: e.target.value as Task['phase'] })}
                      className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-gray-200"
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
                      className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-gray-200"
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
                      className="w-28 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-gray-200 focus:border-gray-300 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="date"
                      value={task.currentStart ?? ''}
                      onChange={(e) => updateTask(task.id, { currentStart: e.target.value || undefined })}
                      className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-gray-200"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="date"
                      value={task.currentFinish ?? ''}
                      onChange={(e) => updateTask(task.id, { currentFinish: e.target.value || undefined })}
                      className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-gray-200"
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
                      className="w-16 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-gray-200 focus:border-gray-300 focus:bg-white focus:outline-none"
                    />
                    <span className="text-xs text-gray-400"> {formatPercent(task.percentComplete)}</span>
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={task.priority}
                      onChange={(e) => updateTask(task.id, { priority: e.target.value as Task['priority'] })}
                      className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-gray-200"
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
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-xs text-gray-400 hover:text-red-600"
                      title={tr('tasks_delete')}
                    >
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
