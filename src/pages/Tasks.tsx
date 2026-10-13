import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { computeHealth, expectedProgress } from '../lib/health'
import { HealthBadge } from '../components/HealthBadge'
import { formatPercent } from '../lib/format'
import { downloadCsv } from '../lib/csv'
import { PRIORITIES, STATUSES, STATUS_ICON } from '../data/config'
import { btnPrimary, btnSecondary, deleteBtn, inputGhost, selectFilter, selectGhost, tableWrap, tbodyRow, theadRow } from '../lib/ui'
import type { Task } from '../types'

const NEW_OPTION = '__new__'

let nextId = 1000

function blankTask(phase: string): Task {
  nextId += 1
  return {
    id: `t${Date.now().toString(36)}${nextId}`,
    wbs: '',
    name: '',
    phase,
    status: 'Not started',
    owner: '',
    percentComplete: 0,
    milestone: false,
    priority: 'Medium',
    mgmtExport: false,
  }
}

function durationDays(task: Task): number | '' {
  if (!task.currentStart || !task.currentFinish) return ''
  return Math.round((new Date(task.currentFinish).getTime() - new Date(task.currentStart).getTime()) / 86_400_000)
}

// Options for a select bound to a user-defined list. Keeps a value that was
// since removed from Settings visible, so the row doesn't silently show
// another option than what's stored.
function listOptions(list: string[], current?: string): string[] {
  return current && !list.includes(current) ? [...list, current] : list
}

export function TasksPage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { tr, tasks, addTask, updateTask, deleteTask, settings, updateSettings } = useApp()
  const [phaseFilter, setPhaseFilter] = useState<string>('all')
  const [areaFilter, setAreaFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [detail, setDetail] = useState(false)

  const filtered = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (phaseFilter === 'all' || task.phase === phaseFilter) &&
          (areaFilter === 'all' || task.projectArea === areaFilter) &&
          (statusFilter === 'all' || task.status === statusFilter),
      ),
    [tasks, phaseFilter, areaFilter, statusFilter],
  )

  const askNewItem = (list: 'phases' | 'projectAreas', label: string): string | null => {
    const name = window.prompt(label)?.trim()
    if (!name) return null
    if (!settings[list].includes(name)) updateSettings({ [list]: [...settings[list], name] })
    return name
  }

  const exportCsv = () => {
    downloadCsv(
      'tasks.csv',
      filtered.map((task) => ({
        WBS: task.wbs,
        ProjectArea: task.projectArea ?? '',
        Name: task.name,
        Phase: task.phase,
        Status: task.status,
        Owner: task.owner,
        BaselineStart: task.baselineStart ?? '',
        BaselineFinish: task.baselineFinish ?? '',
        CurrentStart: task.currentStart ?? '',
        CurrentFinish: task.currentFinish ?? '',
        DurationDays: durationDays(task),
        PercentComplete: task.percentComplete ?? '',
        ExpectedProgress: expectedProgress(task.currentStart, task.currentFinish) ?? '',
        Predecessors: task.predecessors ?? '',
        Priority: task.priority,
        Milestone: task.milestone ? 'YES' : 'NO',
        MgmtExport: task.mgmtExport ? 'YES' : 'NO',
        Health: computeHealth(task, settings),
        Notes: task.notes ?? '',
      })),
    )
  }

  const th = 'px-3 py-2 whitespace-nowrap'
  const td = 'px-3 py-1.5'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} className={selectFilter}>
            <option value="all">
              {tr('tasks_filter_all')} — {tr('tasks_phase')}
            </option>
            {settings.phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className={selectFilter}>
            <option value="all">{tr('tasks_all_areas')}</option>
            {settings.projectAreas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectFilter}>
            <option value="all">
              {tr('tasks_filter_all')} — {tr('common_status')}
            </option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button onClick={onOpenSettings} className={btnSecondary} title={tr('settings_phases')}>
            ⚙️ {tr('settings_phases')}
          </button>
          <label className="ml-1 flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} />
            {tr('tasks_detail_columns')}
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className={btnSecondary}>
            {tr('tasks_export_csv')}
          </button>
          <button
            onClick={() => addTask(blankTask(phaseFilter !== 'all' ? phaseFilter : (settings.phases[0] ?? '')))}
            className={btnPrimary}
          >
            {tr('tasks_add')}
          </button>
        </div>
      </div>

      <div className={tableWrap}>
        <table className={`w-full text-sm ${detail ? 'min-w-[2000px]' : 'min-w-[1250px]'}`}>
          <thead>
            <tr className={theadRow}>
              <th className={th}>WBS</th>
              <th className={th}>{tr('common_project_area')}</th>
              <th className={th}>{tr('tasks_task_name')}</th>
              <th className={th}>{tr('tasks_phase')}</th>
              <th className={th}>{tr('common_status')}</th>
              <th className={th}>{tr('common_owner')}</th>
              {detail && <th className={th}>{tr('tasks_baseline_start')}</th>}
              {detail && <th className={th}>{tr('tasks_baseline_finish')}</th>}
              <th className={th}>{tr('tasks_current_start')}</th>
              <th className={th}>{tr('tasks_current_finish')}</th>
              {detail && <th className={th}>{tr('common_duration')}</th>}
              <th className={th}>{tr('tasks_percent_complete')}</th>
              {detail && <th className={th}>{tr('tasks_expected_progress')}</th>}
              {detail && <th className={th}>{tr('tasks_predecessors')}</th>}
              <th className={th}>{tr('tasks_critical')}</th>
              <th className={th}>{tr('gantt_milestone')}</th>
              {detail && <th className={th}>{tr('common_mgmt_export')}</th>}
              <th className={th}>{tr('common_health')}</th>
              {detail && <th className={th}>{tr('common_notes')}</th>}
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((task) => {
              const health = computeHealth(task, settings)
              const expected = expectedProgress(task.currentStart, task.currentFinish)
              const dur = durationDays(task)
              return (
                <tr key={task.id} className={tbodyRow}>
                  <td className={td}>
                    <input
                      value={task.wbs}
                      onChange={(e) => updateTask(task.id, { wbs: e.target.value })}
                      className={`w-12 text-gray-500 dark:text-gray-400 ${inputGhost}`}
                    />
                  </td>
                  <td className={td}>
                    <select
                      value={task.projectArea ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === NEW_OPTION ? askNewItem('projectAreas', tr('settings_new_item')) : e.target.value
                        if (v !== null) updateTask(task.id, { projectArea: v || undefined })
                      }}
                      className={selectGhost}
                    >
                      <option value="">—</option>
                      {listOptions(settings.projectAreas, task.projectArea).map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                      <option value={NEW_OPTION}>{tr('tasks_new_area')}</option>
                    </select>
                  </td>
                  <td className={td}>
                    <input
                      value={task.name}
                      onChange={(e) => updateTask(task.id, { name: e.target.value })}
                      className={`w-56 ${inputGhost}`}
                    />
                  </td>
                  <td className={td}>
                    <select
                      value={task.phase}
                      onChange={(e) => {
                        const v = e.target.value === NEW_OPTION ? askNewItem('phases', tr('tasks_new_phase_prompt')) : e.target.value
                        if (v !== null) updateTask(task.id, { phase: v })
                      }}
                      className={selectGhost}
                    >
                      {listOptions(settings.phases, task.phase).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                      <option value={NEW_OPTION}>{tr('tasks_new_phase')}</option>
                    </select>
                  </td>
                  <td className={td}>
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
                  <td className={td}>
                    <input
                      value={task.owner}
                      onChange={(e) => updateTask(task.id, { owner: e.target.value })}
                      className={`w-28 ${inputGhost}`}
                    />
                  </td>
                  {detail && (
                    <td className={td}>
                      <input
                        type="date"
                        value={task.baselineStart ?? ''}
                        onChange={(e) => updateTask(task.id, { baselineStart: e.target.value || undefined })}
                        className={selectGhost}
                      />
                    </td>
                  )}
                  {detail && (
                    <td className={td}>
                      <input
                        type="date"
                        value={task.baselineFinish ?? ''}
                        onChange={(e) => updateTask(task.id, { baselineFinish: e.target.value || undefined })}
                        className={selectGhost}
                      />
                    </td>
                  )}
                  <td className={td}>
                    <input
                      type="date"
                      value={task.currentStart ?? ''}
                      onChange={(e) => updateTask(task.id, { currentStart: e.target.value || undefined })}
                      className={selectGhost}
                    />
                  </td>
                  <td className={td}>
                    <input
                      type="date"
                      value={task.currentFinish ?? ''}
                      onChange={(e) => updateTask(task.id, { currentFinish: e.target.value || undefined })}
                      className={selectGhost}
                    />
                  </td>
                  {detail && <td className={`${td} text-gray-500 dark:text-gray-400`}>{dur === '' ? '' : `${dur} d`}</td>}
                  <td className={td}>
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
                    <span className="text-xs text-gray-400 dark:text-gray-500">%</span>
                  </td>
                  {detail && <td className={`${td} text-gray-500 dark:text-gray-400`}>{formatPercent(expected)}</td>}
                  {detail && (
                    <td className={td}>
                      <input
                        value={task.predecessors ?? ''}
                        onChange={(e) => updateTask(task.id, { predecessors: e.target.value || undefined })}
                        className={`w-20 ${inputGhost}`}
                        placeholder="t3, t4"
                      />
                    </td>
                  )}
                  <td className={td}>
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
                  <td className={`${td} text-center`}>
                    <input
                      type="checkbox"
                      checked={task.milestone}
                      onChange={(e) => updateTask(task.id, { milestone: e.target.checked })}
                    />
                  </td>
                  {detail && (
                    <td className={`${td} text-center`}>
                      <input
                        type="checkbox"
                        checked={task.mgmtExport}
                        onChange={(e) => updateTask(task.id, { mgmtExport: e.target.checked })}
                      />
                    </td>
                  )}
                  <td className={td}>
                    <HealthBadge health={health} />
                  </td>
                  {detail && (
                    <td className={td}>
                      <input
                        value={task.notes ?? ''}
                        onChange={(e) => updateTask(task.id, { notes: e.target.value || undefined })}
                        className={`w-56 ${inputGhost}`}
                      />
                    </td>
                  )}
                  <td className={`${td} text-right`}>
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
