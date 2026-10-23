# Research & library selection

Constraints: single offline HTML file, no network at runtime (corporate IT
policy), only permissive licenses (MIT / Apache-2.0 / BSD / ISC), prefer
proven libraries over home-grown code.

## Reference tools (studied for UX/data model only - code not reused, GPL/AGPL/server)
OpenProject, GanttProject, ProjectLibre, Leantime, Kanboard, Taiga. Common
patterns adopted: portfolio of projects, WBS tree with summary tasks,
FS/SS/FF/SF dependencies with lag, critical path, multiple baselines, RAID log,
change requests, status report export.

"Single-file app that saves itself to a file" pattern: TiddlyWiki, Excalidraw
(both use the File System Access API with a download/upload fallback).

## Selected libraries (verified with `npm view`, 2026-10)
| Purpose | Library | License | Notes |
|---|---|---|---|
| Save/open workspace file | browser-fs-access 0.38 | Apache-2.0 | GoogleChromeLabs; FSA with legacy fallback, 0 deps |
| Persist file handle / cache | idb-keyval 6.3 | Apache-2.0 | 0 deps |
| State + undo/redo | zustand 5 + zundo 2 | MIT | |
| Schema validation / migration | zod 4 | MIT | |
| Gantt rendering | frappe-gantt 1.2 | MIT | 0 deps. Deps = array of task ids, `custom_class`, events on_click/on_date_change/on_progress_change/on_double_click, `holidays`, `ignore: ['weekend', dates]`, `move_dependencies`, `readonly`. Draws all links as FS arrows (link type semantics handled by our scheduler). |
| Unit tests | vitest 3.2 | MIT | v5 needs Vite 6+ |

Rejected: SVAR React Gantt (MIT core, but 17 transitive deps incl. its own grid/store/editor duplicating ours; auto-scheduling is PRO); gantt-task-react (unmaintained since 2022); DHTMLX Gantt (GPL); SheetJS `xlsx` from npm (stuck at 0.18.5, CVE-2023-30533) -> ExcelJS (MIT) for Excel import.

Scheduling (CPM, working-day calendar) is implemented in-house in
`src/lib/schedule/` with unit tests: no maintained permissive JS library
covers calendar-aware CPM with FS/SS/FF/SF + lag.

## MS Project XML (from the Project XML Data Interchange schema; verify against a sample export in E4)
- Task: UID, ID, Name, WBS, OutlineLevel, Start, Finish, Duration (ISO 8601, e.g. `PT16H0M0S`), PercentComplete, Milestone, Summary, Manual, Baseline (Number, Start, Finish).
- PredecessorLink: PredecessorUID, Type (0 = FF, 1 = FS, 2 = SF, 3 = SS), LinkLag (tenths of minutes), LagFormat.

Note: the reference sites (learn.microsoft.com, ganttproject.biz, ...) are not
reachable from the build sandbox; notes above are from the published schema and
will be validated with a real MSP XML sample.
