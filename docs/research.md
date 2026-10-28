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
| Task table | @tanstack/react-table 8 | MIT | headless: sorting, column visibility; filtering/outline done by us |
| Kanban drag & drop | @dnd-kit/core 6 | MIT | pointer + keyboard sensors (accessible) |
| PowerPoint export | pptxgenjs 4.0 | MIT | deps jszip (MIT OR GPL → MIT), pako (MIT AND Zlib); `image-size` pinned to 2.0.4 via `overrides` (GHSA-5p2g-fcmc-qvqq; the browser build never loads it) |
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

## E1 design notes

- **Outline model = MS Project's**: tasks are a flat list in outline order with an
  `outlineLevel`; the parent is the nearest previous task with a lower level, WBS
  numbers are derived. Indent/outdent/move operate on subtrees
  (`src/lib/schedule/tree.ts`). It maps 1:1 to MSP XML `OutlineLevel` for E4.
- **Scheduler** (`src/lib/schedule/cpm.ts`): dates are mapped to working-day
  ordinals (`calendar.ts`), then a textbook forward/backward pass (Kahn topological
  order, cycle detection). Milestones sit at the end of the day, like MSP. Links
  to/from summary tasks are expanded to their leaf tasks. Manual tasks and tasks
  with an actual start keep their dates but drive successors. Dragging or editing
  the start of an auto task creates a "start no earlier than" constraint (MSP
  behaviour). Every edit re-runs `applySchedule` inside the store, so one undo
  step covers the edit and its knock-on effects.
- **Migration** (schema 4): existing tasks become *manual* so no stored date
  changes; text predecessors (`t1`, `3FS+2d`) become typed links.
- **frappe-gantt limitations**: all links are drawn as FS arrows (the type is in
  the popup), no baseline bars (variance is a table column and in the popup),
  names/popups use `innerHTML`, so everything passed in is HTML-escaped (an e2e
  test checks a task named `<img onerror=…>`).
- **CSP**: frappe-gantt colours holiday columns with `setAttribute('style', …)`.
  The policy therefore adds `style-src-attr 'unsafe-inline'` - style *attributes*
  only; `<style>` blocks stay hash-locked, scripts stay hash-locked, and with
  `connect-src`/`img-src` closed a style attribute cannot send data anywhere.

## E2 design notes

- **RAID** follows the common PMO practice (Risks, Assumptions, Issues,
  Dependencies + a Decision log); risk responses use the PMBOK/PRINCE2 set
  Avoid/Mitigate/Transfer/Accept. Scoring keeps the workbook's 4×4 P×I matrix
  (`src/lib/raid.ts`), so existing registers keep their numbers.
- **Change requests** use the workbook's CONFIG types and states. Approved,
  implemented and closed CRs add their cost to the approved budget everywhere
  (`src/lib/changes.ts`); approval offers re-baselining - standard change
  control so variance is measured against the approved plan.
- **Audit trail** (`src/lib/audit.ts`) is a field-level diff of the user's edit
  taken in the store *before* the scheduler runs; bulk operations (baseline,
  renames) write one summary line. Edits of one field within 2 minutes merge.
  The log is part of the project data, so undo removes the undone entries.
- **Custom statuses** map to six fixed meanings; Health, the scheduler, the
  board and the statistics read the meaning (`src/lib/status.ts`), never the
  name, so the Excel Health formula is untouched.

## E3 design notes

- **PDF = browser print** (`@media print`, `@page A4 landscape`): no PDF library,
  text stays selectable and it works with "Microsoft Print to PDF". The page
  switches to light mode for printing (`printLight`).
- **PowerPoint = pptxgenjs** with native shapes, tables and a native column
  chart, so the deck stays editable. It is generated in the browser and saved
  via a Blob download (allowed by the CSP; no network).
- **Report content** (`src/lib/report.ts`) is a pure function of the project
  data and period, shared by screen, print and PPTX. Saved reports keep the
  edited texts and RAG for the history and the portfolio trend.
- **Roadmap** follows the workbook's RoadMap.bas: tasks flagged Mgmt export in
  Mgmt order, one row per item, lanes by phase/area.
- Bundle size: the portable file grew to ~1.2 MB (≈360 kB gzip), mostly
  pptxgenjs + jszip - acceptable for a local file.
