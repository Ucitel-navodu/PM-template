import { describe, expect, it } from 'vitest'
import { czechHolidays } from '../../data/settings'
import type { Dependency, Task } from '../../types'
import { WorkCalendar } from './calendar'
import { applySchedule, schedule } from './cpm'
import { formatDependencies, parseDependencies } from './predecessors'
import { indent, move, outdent, outline } from './tree'

const cal = { workingDays: [1, 2, 3, 4, 5], holidays: czechHolidays(2026) }
// Week of 26 Oct 2026: Wed 28 Oct is a public holiday; DST ends Sun 25 Oct.
const START = '2026-10-19' // Monday

let n = 0
function task(id: string, p: Partial<Task> = {}): Task {
  return {
    id,
    no: ++n,
    outlineLevel: 1,
    wbs: '',
    name: id,
    phase: '',
    status: 'Not started',
    owner: '',
    percentComplete: 0,
    schedulingMode: 'auto',
    duration: 1,
    dependencies: [],
    milestone: false,
    priority: 'Medium',
    mgmtExport: false,
    ...p,
  }
}
const dep = (predId: string, type: Dependency['type'] = 'FS', lag = 0): Dependency => ({ predId, type, lag })
const run = (tasks: Task[], start = START) => schedule(tasks, cal, start).tasks

describe('WorkCalendar', () => {
  const c = new WorkCalendar(cal, '2026-01-01')
  it('skips weekends and holidays across the DST switch', () => {
    expect(c.addWorkdays('2026-10-23', 1)).toBe('2026-10-26') // Fri -> Mon
    expect(c.addWorkdays('2026-10-27', 1)).toBe('2026-10-29') // Tue -> Thu (28 Oct holiday)
    expect(c.workdaysBetween('2026-10-19', '2026-11-01')).toBe(9)
    expect(c.workdaysBetween('2026-10-24', '2026-10-25')).toBe(0)
  })
  it('maps a non-working day to the next working day', () => {
    expect(c.date(c.ordinal('2026-10-24'))).toBe('2026-10-26')
    expect(c.date(c.ordinal('2026-10-28'))).toBe('2026-10-29')
  })
})

describe('forward pass', () => {
  it('starts an unlinked auto task at the project start', () => {
    const r = run([task('a', { duration: 5 })])
    expect(r.get('a')).toMatchObject({ start: '2026-10-19', finish: '2026-10-23' })
  })

  it('FS: successor starts the next working day, over weekend and holiday', () => {
    const r = run([task('a', { duration: 5 }), task('b', { duration: 3, dependencies: [dep('a')] })])
    // a: Mon 19 - Fri 23; b: Mon 26, Tue 27, (Wed 28 holiday), Thu 29
    expect(r.get('b')).toMatchObject({ start: '2026-10-26', finish: '2026-10-29' })
  })

  it('FS with lag and lead', () => {
    const r = run([
      task('a', { duration: 5 }),
      task('b', { duration: 1, dependencies: [dep('a', 'FS', 2)] }),
      task('c', { duration: 1, dependencies: [dep('a', 'FS', -2)] }),
    ])
    // a ends Fri 23; +2 working days of lag skips Mon 26 and Tue 27 (Wed 28 is a holiday)
    expect(r.get('b')!.start).toBe('2026-10-29')
    // 2 days of lead: starts Thu 22
    expect(r.get('c')!.start).toBe('2026-10-22')
  })

  it('SS, FF and SF links', () => {
    const r = run([
      task('a', { duration: 5 }), // Mon 19 - Fri 23
      task('ss', { duration: 2, dependencies: [dep('a', 'SS', 1)] }), // Tue 20 - Wed 21
      task('ff', { duration: 2, dependencies: [dep('a', 'FF')] }), // Thu 22 - Fri 23
      task('sf', { duration: 2, dependencies: [dep('a', 'SF', 3)], constraint: undefined }),
    ])
    expect(r.get('ss')).toMatchObject({ start: '2026-10-20', finish: '2026-10-21' })
    expect(r.get('ff')).toMatchObject({ start: '2026-10-22', finish: '2026-10-23' })
    // SF: finish >= start(a) + 3 = Thu 22 (exclusive) -> finishes Wed 21, but not before project start
    expect(r.get('sf')).toMatchObject({ start: '2026-10-20', finish: '2026-10-21' })
  })

  it('places a milestone on the predecessor finish day and its successor on the next working day', () => {
    const r = run([
      task('a', { duration: 5 }),
      task('m', { duration: 0, milestone: true, dependencies: [dep('a')] }),
      task('b', { duration: 1, dependencies: [dep('m')] }),
    ])
    expect(r.get('m')).toMatchObject({ start: '2026-10-23', finish: '2026-10-23' })
    expect(r.get('b')!.start).toBe('2026-10-26')
  })

  it('honours SNET and MSO constraints', () => {
    const r = run([
      task('a', { duration: 1, constraint: { type: 'SNET', date: '2026-10-24' } }), // Saturday -> Monday
      task('b', { duration: 1, constraint: { type: 'MSO', date: '2026-10-20' }, dependencies: [dep('a')] }),
    ])
    expect(r.get('a')!.start).toBe('2026-10-26')
    expect(r.get('b')!.start).toBe('2026-10-20')
  })

  it('keeps manual and already-started tasks, but lets them drive successors', () => {
    const r = run([
      task('m', { schedulingMode: 'manual', currentStart: '2026-11-02', currentFinish: '2026-11-03' }),
      task('s', { duration: 1, dependencies: [dep('m')] }),
      task('p', { status: 'In progress', percentComplete: 0.3, currentStart: '2026-10-14', duration: 3 }),
    ])
    expect(r.get('m')).toMatchObject({ start: '2026-11-02', finish: '2026-11-03', duration: 2 })
    expect(r.get('s')!.start).toBe('2026-11-04')
    expect(r.get('p')).toMatchObject({ start: '2026-10-14', finish: '2026-10-16' })
  })

  it('cancelled tasks drive nothing', () => {
    const r = run([
      task('x', { status: 'Cancelled', schedulingMode: 'manual', currentStart: '2026-12-01', currentFinish: '2026-12-10' }),
      task('y', { duration: 1, dependencies: [dep('x')] }),
    ])
    expect(r.get('y')!.start).toBe(START)
  })

  it('reports a dependency cycle instead of looping', () => {
    const res = schedule([task('a', { dependencies: [dep('b')] }), task('b', { dependencies: [dep('a')] })], cal, START)
    expect(res.cycle.sort()).toEqual(['a', 'b'])
  })
})

describe('critical path and float', () => {
  // a(3) -> c(2); b(1) -> c ; d(1) independent
  const tasks = () => [
    task('a', { duration: 3 }),
    task('b', { duration: 1 }),
    task('c', { duration: 2, dependencies: [dep('a'), dep('b')] }),
    task('d', { duration: 1 }),
  ]
  it('marks the longest path critical and computes floats', () => {
    const r = run(tasks())
    expect(r.get('a')!.critical).toBe(true)
    expect(r.get('c')!.critical).toBe(true)
    expect(r.get('b')).toMatchObject({ critical: false, totalFloat: 2, freeFloat: 2 })
    expect(r.get('d')).toMatchObject({ critical: false, totalFloat: 4 })
  })
  it('done tasks are not critical', () => {
    const t = tasks()
    t[0] = { ...t[0], status: 'Done', percentComplete: 1, currentStart: START }
    expect(run(t).get('a')!.critical).toBe(false)
  })
})

describe('summary tasks', () => {
  it('roll up dates, % and apply links to their leaves', () => {
    n = 0
    const tasks = [
      task('pre', { duration: 2 }),
      task('S', { outlineLevel: 1, dependencies: [dep('pre')] }),
      task('k1', { outlineLevel: 2, duration: 2, percentComplete: 1 }),
      task('k2', { outlineLevel: 2, duration: 2, dependencies: [dep('k1')] }),
    ]
    const r = run(tasks)
    expect(r.get('k1')!.start).toBe('2026-10-21')
    expect(r.get('S')).toMatchObject({ summary: true, start: '2026-10-21', finish: '2026-10-26' })
    const p = applySchedule(
      { id: 'p', info: { start: START } as never, lists: {} as never, tasks, milestones: [], budget: [], risks: [], baselines: [], views: [], createdAt: '', updatedAt: '' },
      cal,
    )
    const s = p.tasks.find((t) => t.id === 'S')!
    expect(s.percentComplete).toBe(0.5)
    expect(p.tasks.map((t) => t.wbs)).toEqual(['1', '2', '2.1', '2.2'])
  })

  it('applySchedule returns the same object when nothing changes', () => {
    const project = { id: 'p', info: { start: START } as never, lists: {} as never, tasks: [task('a')], milestones: [], budget: [], risks: [], baselines: [], views: [], createdAt: '', updatedAt: '' }
    const once = applySchedule(project, cal)
    expect(applySchedule(once, cal)).toBe(once)
  })
})

describe('outline editing', () => {
  const list = () => [task('a'), task('b'), task('c'), task('d')]
  it('indents under the previous task and outdents back', () => {
    const t = indent(list(), 'b')
    expect(outline(t).get('b')!.parentId).toBe('a')
    expect(indent(t, 'b')).toBe(t) // cannot go two levels deeper
    expect(outline(outdent(t, 'b')).get('b')!.parentId).toBeUndefined()
  })
  it('moves a task with its subtree', () => {
    const t = indent(list(), 'b') // a > b, c, d
    expect(move(t, 'a', 1).map((x) => x.id)).toEqual(['c', 'a', 'b', 'd'])
    expect(move(t, 'c', -1).map((x) => x.id)).toEqual(['c', 'a', 'b', 'd'])
  })
})

describe('predecessor notation', () => {
  n = 0
  const tasks = [task('a'), task('b'), task('c')] // numbers 1..3
  it('parses MS Project style text', () => {
    const r = parseDependencies('1; 2SS+2d, 3FF-1', tasks, 'x')
    expect(r.errors).toEqual([])
    expect(r.deps).toEqual([dep('a'), dep('b', 'SS', 2), dep('c', 'FF', -1)])
    expect(formatDependencies(r.deps, tasks)).toBe('1; 2SS+2d; 3FF-1d')
  })
  it('reports unknown tasks, self links and garbage', () => {
    expect(parseDependencies('9; 1; foo', tasks, 'a').errors).toEqual(['9', '1', 'foo'])
  })
})

describe('performance', () => {
  it('schedules 1000 linked tasks quickly', () => {
    const many = Array.from({ length: 1000 }, (_, i) => task(`t${i}`, { duration: 3, dependencies: i ? [dep(`t${i - 1}`)] : [] }))
    const t0 = performance.now()
    const r = run(many)
    expect(performance.now() - t0).toBeLessThan(200)
    expect(r.get('t999')!.critical).toBe(true)
  })
})
