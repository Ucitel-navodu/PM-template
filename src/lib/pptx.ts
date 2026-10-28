import type PptxGenJS from 'pptxgenjs'
import type { ReportSettings, StatusReport } from '../types'
import type { StatusReportData, Roadmap } from './report'
import type { ProjectSummary } from './portfolio'
import { riskScore } from './raid'
import { formatDate, formatMoney, formatPercent } from './format'
import { itemColor, timeline, type ColorBy } from '../components/Roadmap'

/*
 * PowerPoint decks built with pptxgenjs (MIT): native, editable text boxes,
 * shapes, tables and charts - the PM can still adjust the deck in PowerPoint.
 * 16:9 (13.33 x 7.5 in). Everything is generated in the browser and saved
 * through a Blob download; nothing leaves the computer.
 */

type Tr = (key: string) => string

const RAG_HEX: Record<string, string> = { Green: '16A34A', Amber: 'F59E0B', Red: 'E11D48', Grey: '9CA3AF' }
const GREY = '6B7280'
const DARK = '111827'
const hex = (c: string) => c.replace('#', '').toUpperCase()

async function newDeck(settings: ReportSettings, title: string): Promise<PptxGenJS> {
  const { default: Pptx } = await import('pptxgenjs')
  const pptx = new Pptx()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = title
  pptx.company = settings.organization || ''
  const accent = hex(settings.accentColor || '#4f46e5')
  pptx.defineSlideMaster({
    title: 'PM',
    background: { color: 'FFFFFF' },
    objects: [
      { rect: { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: accent } } },
      {
        text: {
          text: [settings.organization, settings.footer].filter(Boolean).join(' · '),
          options: { x: 0.5, y: 7.05, w: 9, h: 0.3, fontSize: 9, color: GREY },
        },
      },
      ...(settings.logoDataUrl ? [{ image: { data: settings.logoDataUrl, x: 11.6, y: 0.3, w: 1.2, h: 0.6, sizing: { type: 'contain' as const, w: 1.2, h: 0.6 } } }] : []),
    ],
    slideNumber: { x: 12.5, y: 7.05, fontSize: 9, color: GREY },
  })
  return pptx
}

function heading(slide: PptxGenJS.Slide, text: string, sub?: string) {
  slide.addText(text, { x: 0.5, y: 0.3, w: 10.8, h: 0.6, fontSize: 24, bold: true, color: DARK })
  if (sub) slide.addText(sub, { x: 0.5, y: 0.85, w: 10.8, h: 0.35, fontSize: 12, color: GREY })
}

function ragPill(slide: PptxGenJS.Slide, rag: string, x: number, y: number, label: string) {
  slide.addShape('roundRect', { x, y, w: 1.6, h: 0.5, fill: { color: RAG_HEX[rag] ?? RAG_HEX.Grey }, rectRadius: 0.1, line: { color: RAG_HEX[rag] ?? RAG_HEX.Grey } })
  slide.addText(label, { x, y, w: 1.6, h: 0.5, fontSize: 14, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
}

function kpi(slide: PptxGenJS.Slide, x: number, label: string, value: string, sub = '') {
  slide.addShape('rect', { x, y: 1.55, w: 2.95, h: 1.15, fill: { color: 'F3F4F6' }, line: { color: 'E5E7EB' } })
  slide.addText(label, { x: x + 0.15, y: 1.6, w: 2.7, h: 0.3, fontSize: 10, color: GREY })
  slide.addText(value, { x: x + 0.15, y: 1.9, w: 2.7, h: 0.45, fontSize: 20, bold: true, color: DARK })
  if (sub) slide.addText(sub, { x: x + 0.15, y: 2.33, w: 2.7, h: 0.3, fontSize: 10, color: GREY })
}

const headerRow = (cells: string[], accent: string): PptxGenJS.TableRow =>
  cells.map((text) => ({ text, options: { bold: true, color: 'FFFFFF', fill: { color: accent }, fontSize: 10 } }))

const textBox = (slide: PptxGenJS.Slide, title: string, body: string, x: number, y: number, w: number, h: number) => {
  slide.addText(title, { x, y, w, h: 0.35, fontSize: 13, bold: true, color: DARK })
  slide.addText(body || '—', { x, y: y + 0.38, w, h: h - 0.38, fontSize: 11, color: '374151', valign: 'top', paraSpaceAfter: 2 })
}

/** RoadMap as native shapes: one slide, swimlanes, bars, milestone diamonds, today line. */
export function addRoadmapSlide(pptx: PptxGenJS, roadmap: Roadmap, title: string, colorBy: ColorBy, phases: string[], lang: 'CZ' | 'EN') {
  const slide = pptx.addSlide({ masterName: 'PM' })
  heading(slide, title)
  const left = 0.5
  const labelW = 1.7
  const right = 12.85
  const top = 1.35
  const bottom = 6.85
  const tl = timeline(roadmap.start, roadmap.end)
  const X = (key: string) => left + labelW + tl.x(key) * (right - left - labelW)
  const lanes = roadmap.lanes.map((l) => ({ ...l, rows: l.items.map((i) => [i]) }))
  const rows = lanes.reduce((n, l) => n + Math.max(1, l.rows.length), 0)
  const rowH = Math.min(0.42, (bottom - top - 0.35 - lanes.length * 0.08) / Math.max(1, rows))
  const locale = lang === 'CZ' ? 'cs-CZ' : 'en-GB'
  tl.months.forEach((m, i) => {
    const x = left + labelW + m.x * (right - left - labelW)
    const q = m.date.getMonth() % 3 === 0
    slide.addShape('line', { x, y: top + 0.3, w: 0, h: bottom - top - 0.3, line: { color: q ? 'D1D5DB' : 'F3F4F6', width: 0.75 } })
    const label = tl.quarterly ? (q ? `Q${m.date.getMonth() / 3 + 1} ${m.date.getFullYear()}` : '') : m.date.toLocaleDateString(locale, { month: 'short' })
    if (label && i < tl.months.length - 1) slide.addText(label, { x, y: top, w: 1.2, h: 0.28, fontSize: 9, color: GREY })
  })
  let y = top + 0.35
  lanes.forEach((lane, li) => {
    const h = Math.max(1, lane.rows.length) * rowH + 0.08
    if (li % 2) slide.addShape('rect', { x: left, y, w: right - left, h, fill: { color: 'F9FAFB' }, line: { color: 'F9FAFB' } })
    slide.addText(lane.name, { x: left + 0.05, y, w: labelW - 0.1, h, fontSize: 10, bold: true, color: DARK, valign: 'middle' })
    lane.rows.forEach((row, ri) =>
      row.forEach((it) => {
        const cy = y + 0.04 + ri * rowH + rowH / 2
        const color = hex(itemColor(it, colorBy, phases))
        const fs = Math.max(7, Math.min(9, rowH * 22))
        if (it.milestone) {
          const s = Math.min(0.26, rowH * 0.7)
          slide.addShape('diamond', { x: X(it.start) - s / 2, y: cy - s / 2, w: s, h: s, fill: { color }, line: { color } })
          const left = X(it.start) + 2.4 > right
          slide.addText(it.name, { x: left ? X(it.start) - s / 2 - 2.43 : X(it.start) + s / 2 + 0.03, y: cy - rowH / 2, w: 2.4, h: rowH, fontSize: fs, color: DARK, valign: 'middle', align: left ? 'right' : 'left' })
          return
        }
        const x1 = X(it.start)
        const w = Math.max(0.05, X(it.finish) - x1 + 0.01)
        const fits = w > it.name.length * 0.065 + 0.1
        slide.addShape('roundRect', { x: x1, y: cy - rowH * 0.36, w, h: rowH * 0.72, fill: { color }, line: { color }, rectRadius: 0.05 })
        const left = !fits && x1 + w + 2.4 > right
        slide.addText(
          it.name,
          fits
            ? { x: x1, y: cy - rowH / 2, w, h: rowH, fontSize: fs, color: 'FFFFFF', valign: 'middle' }
            : { x: left ? x1 - 2.43 : x1 + w + 0.03, y: cy - rowH / 2, w: 2.4, h: rowH, fontSize: fs, color: DARK, valign: 'middle', align: left ? 'right' : 'left' },
        )
      }),
    )
    y += h
  })
  const today = new Date()
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (key >= roadmap.start && key <= roadmap.end) slide.addShape('line', { x: X(key), y: top + 0.3, w: 0, h: y - top - 0.3, line: { color: 'E11D48', width: 1.25, dashType: 'dash' } })
}

export interface DeckInput {
  data: StatusReportData
  report: Pick<StatusReport, 'rag' | 'ragComment' | 'summary' | 'achievements' | 'nextSteps' | 'escalations' | 'date'>
  roadmap: Roadmap
  colorBy: ColorBy
  settings: ReportSettings
  tr: Tr
  lang: 'CZ' | 'EN'
}

/** Status report / SteCo deck (8 slides). Returns the file name. */
export async function downloadStatusDeck({ data, report, roadmap, colorBy, settings, tr, lang }: DeckInput): Promise<string> {
  const p = data.project
  const cur = p.info.currency
  const pptx = await newDeck(settings, `${p.info.projectName} – ${tr('report_title')}`)
  const accent = hex(settings.accentColor || '#4f46e5')
  const ragLabel = (r: string) => tr(`report_rag_${r}`)

  // 1 Title
  const s1 = pptx.addSlide({ masterName: 'PM' })
  s1.addText(p.info.projectName, { x: 0.8, y: 2.3, w: 11, h: 1, fontSize: 38, bold: true, color: DARK })
  s1.addText(`${tr('report_title')} · ${formatDate(report.date)}`, { x: 0.8, y: 3.3, w: 11, h: 0.5, fontSize: 18, color: GREY })
  s1.addText([p.info.projectId, p.info.itpm && `ITPM: ${p.info.itpm}`, p.info.businessOwner && `Business owner: ${p.info.businessOwner}`].filter(Boolean).join('   ·   '), { x: 0.8, y: 3.9, w: 11, h: 0.4, fontSize: 12, color: GREY })
  ragPill(s1, report.rag, 0.8, 4.6, ragLabel(report.rag))

  // 2 Executive summary
  const s2 = pptx.addSlide({ masterName: 'PM' })
  heading(s2, tr('report_exec_summary'), `${tr('report_period')}: ${formatDate(data.period.from)} – ${formatDate(data.period.to)}`)
  ragPill(s2, report.rag, 11.2, 0.35, ragLabel(report.rag))
  kpi(s2, 0.5, tr('portfolio_progress'), formatPercent(data.summary.progress))
  kpi(s2, 3.6, tr('plan_finish'), formatDate(data.finish) || '—', data.finishVariance ? `${data.finishVariance > 0 ? '+' : ''}${data.finishVariance} ${tr('report_wd_vs_baseline')}` : '')
  kpi(s2, 6.7, tr('report_budget_forecast'), formatMoney(data.budget.forecast, cur), `${tr('budget_current')}: ${formatMoney(data.budget.current, cur)}`)
  kpi(s2, 9.8, tr('report_open_raid'), `${data.summary.openRisks} / ${data.summary.openIssues}`, `${tr('cr_open')}: ${data.changes.open.length}`)
  textBox(s2, tr('report_summary'), [report.ragComment, report.summary].filter(Boolean).join('\n\n'), 0.5, 3.0, 6.1, 3.9)
  textBox(s2, tr('report_escalations'), report.escalations, 6.9, 3.0, 5.9, 3.9)

  // 3 RoadMap
  addRoadmapSlide(pptx, roadmap, tr('report_roadmap'), colorBy, p.lists.phases, lang)

  // 4 Milestones
  const s4 = pptx.addSlide({ masterName: 'PM' })
  heading(s4, tr('nav_milestones'))
  const ms = [...data.milestones.overdue, ...data.milestones.upcoming]
  s4.addTable(
    [
      headerRow([tr('report_milestone'), tr('report_planned'), tr('report_baseline'), tr('common_status')], accent),
      ...(ms.length
        ? ms.map((m) => {
            const overdue = data.milestones.overdue.includes(m)
            return [
              { text: m.name },
              { text: formatDate(m.plannedDate), options: overdue ? { color: 'E11D48', bold: true } : {} },
              { text: formatDate(m.baselineDate) },
              { text: overdue ? tr('report_overdue') : m.paymentStatus },
            ]
          })
        : [[{ text: '—' }, { text: '' }, { text: '' }, { text: '' }]]),
    ],
    { x: 0.5, y: 1.3, w: 12.3, colW: [6.3, 2, 2, 2], fontSize: 11, border: { type: 'solid', color: 'E5E7EB', pt: 0.75 } },
  )

  // 5 Done / next
  const s5 = pptx.addSlide({ masterName: 'PM' })
  heading(s5, tr('report_progress_title'))
  textBox(s5, tr('report_achievements'), report.achievements, 0.5, 1.3, 6.0, 5.6)
  textBox(s5, tr('report_next_steps'), report.nextSteps, 6.9, 1.3, 5.9, 5.6)

  // 6 Risks and issues
  const s6 = pptx.addSlide({ masterName: 'PM' })
  heading(s6, tr('dash_risks'))
  s6.addTable(
    [
      headerRow(['ID', tr('risks_type'), tr('raid_title'), 'P×I', tr('common_owner'), tr('raid_detail')], accent),
      ...(data.risks.length
        ? data.risks.map((r) => {
            const sc = riskScore(r)
            return [
              { text: r.id },
              { text: r.type },
              { text: r.title || r.description },
              { text: String(sc), options: { bold: true, align: 'center' as const, color: 'FFFFFF', fill: { color: sc >= 9 ? 'E11D48' : sc >= 4 ? 'F59E0B' : '16A34A' } } },
              { text: r.owner },
              { text: r.type === 'Issue' ? r.resolution ?? '' : r.mitigation },
            ]
          })
        : [[{ text: '—' }, { text: '' }, { text: '' }, { text: '' }, { text: '' }, { text: '' }]]),
    ],
    { x: 0.5, y: 1.3, w: 12.3, colW: [0.9, 1.1, 3.6, 0.7, 1.8, 4.2], fontSize: 10, border: { type: 'solid', color: 'E5E7EB', pt: 0.75 } },
  )

  // 7 Changes and decisions
  const s7 = pptx.addSlide({ masterName: 'PM' })
  heading(s7, tr('report_changes_decisions'))
  const crs = [...data.changes.open, ...data.changes.decided]
  s7.addTable(
    [
      headerRow(['ID', tr('cr_title'), tr('cr_type'), tr('cr_impact_days'), `${tr('report_impact')} (${cur})`, tr('common_status')], accent),
      ...(crs.length
        ? crs.map((c) => [{ text: c.id }, { text: c.title }, { text: c.type }, { text: String(c.impactDays) }, { text: c.impactCost.toLocaleString('cs-CZ') }, { text: c.status }])
        : [[{ text: '—' }, { text: '' }, { text: '' }, { text: '' }, { text: '' }, { text: '' }]]),
    ],
    { x: 0.5, y: 1.3, w: 12.3, colW: [1, 5.1, 1.4, 1.4, 2, 1.4], fontSize: 10, border: { type: 'solid', color: 'E5E7EB', pt: 0.75 } },
  )
  if (data.decisions.length) {
    textBox(
      s7,
      tr('raid_Decision'),
      data.decisions.map((d) => `• ${formatDate(d.decisionDate)} ${d.title || d.description}${d.decidedBy ? ` (${d.decidedBy})` : ''}`).join('\n'),
      0.5,
      4.6,
      12.3,
      2.3,
    )
  }

  // 8 Budget
  const s8 = pptx.addSlide({ masterName: 'PM' })
  heading(s8, tr('nav_budget'))
  const b = data.budget
  s8.addChart(
    'bar',
    [
      {
        name: cur,
        labels: [tr('budget_current'), tr('report_planned'), tr('report_committed'), tr('report_actual'), tr('report_budget_forecast')],
        values: [b.current, b.planned, b.committed, b.actual, b.forecast],
      },
    ],
    { x: 0.5, y: 1.3, w: 7.8, h: 5.5, barDir: 'col', chartColors: [accent], showValue: true, dataLabelFormatCode: '#,##0', valAxisLabelFormatCode: '#,##0', catAxisLabelFontSize: 10, valAxisLabelFontSize: 9, dataLabelFontSize: 9 },
  )
  s8.addTable(
    [
      [{ text: tr('budget_approved') }, { text: formatMoney(b.approved, cur), options: { align: 'right' } }],
      [{ text: tr('budget_approved_changes') }, { text: formatMoney(b.changes, cur), options: { align: 'right' } }],
      [{ text: tr('budget_current'), options: { bold: true } }, { text: formatMoney(b.current, cur), options: { bold: true, align: 'right' } }],
      [{ text: tr('report_actual') }, { text: formatMoney(b.actual, cur), options: { align: 'right' } }],
      [{ text: tr('report_budget_forecast') }, { text: formatMoney(b.forecast, cur), options: { align: 'right' } }],
      [{ text: tr('report_variance'), options: { bold: true } }, { text: formatMoney(b.variance, cur), options: { bold: true, align: 'right', color: b.variance < 0 ? 'E11D48' : '16A34A' } }],
    ],
    { x: 8.6, y: 1.5, w: 4.2, colW: [2.2, 2], fontSize: 11, border: { type: 'solid', color: 'E5E7EB', pt: 0.75 } },
  )

  const fileName = `${p.info.projectName.replace(/[\\/:*?"<>|]+/g, '-')} - status ${report.date}.pptx`
  await pptx.writeFile({ fileName, compression: true })
  return fileName
}

/** One-slide portfolio overview for management (plus a title slide). */
export async function downloadPortfolioDeck(rows: { name: string; itpm: string; summary: ProjectSummary; currency: string; budget: number; trend?: string }[], settings: ReportSettings, tr: Tr, date: string): Promise<string> {
  const pptx = await newDeck(settings, tr('report_portfolio_title'))
  const accent = hex(settings.accentColor || '#4f46e5')
  const s1 = pptx.addSlide({ masterName: 'PM' })
  s1.addText(tr('report_portfolio_title'), { x: 0.8, y: 2.6, w: 11, h: 1, fontSize: 36, bold: true, color: DARK })
  s1.addText(formatDate(date), { x: 0.8, y: 3.6, w: 11, h: 0.5, fontSize: 18, color: GREY })

  const s2 = pptx.addSlide({ masterName: 'PM' })
  heading(s2, tr('report_portfolio_title'))
  s2.addTable(
    [
      headerRow([tr('portfolio_rag'), tr('dash_project_name'), 'ITPM', tr('portfolio_progress'), tr('portfolio_next_milestone'), tr('report_open_raid'), tr('portfolio_budget_used'), tr('portfolio_finish')], accent),
      ...rows.map((r) => [
        { text: `${r.summary.rag}${r.trend ? ` ${r.trend}` : ''}`, options: { bold: true, color: 'FFFFFF', fill: { color: RAG_HEX[r.summary.rag] }, align: 'center' as const } },
        { text: r.name, options: { bold: true } },
        { text: r.itpm },
        { text: formatPercent(r.summary.progress) },
        { text: r.summary.nextMilestone ? `${r.summary.nextMilestone.name} (${formatDate(r.summary.nextMilestone.plannedDate)})` : '—' },
        { text: `${r.summary.openRisks} / ${r.summary.openIssues}` },
        { text: r.summary.budgetUsedPct === null ? '—' : `${Math.round(r.summary.budgetUsedPct * 100)} %` },
        { text: formatDate(r.summary.finish) },
      ]),
    ],
    { x: 0.5, y: 1.3, w: 12.3, colW: [1, 2.8, 1.5, 1, 2.6, 1.2, 1.1, 1.1], fontSize: 10, border: { type: 'solid', color: 'E5E7EB', pt: 0.75 }, autoPage: true },
  )
  const fileName = `Portfolio ${date}.pptx`
  await pptx.writeFile({ fileName, compression: true })
  return fileName
}
