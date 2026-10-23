// E2E: scheduling features of the portable build via file:// (Europe/Prague).
// Usage: node tests/e2e/planning.mjs [path-to-index.html] [screenshot-dir]
import { chromium } from 'playwright'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

const url = `file://${resolve(process.argv[2] ?? 'dist-portable/index.html')}`
const shots = process.argv[3]
if (shots) mkdirSync(shots, { recursive: true })

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const ctx = await browser.newContext({ timezoneId: 'Europe/Prague', locale: 'cs-CZ', viewport: { width: 1600, height: 950 } })
const page = await ctx.newPage()
const errors = []
const requests = []
page.on('console', (m) => (m.type() === 'error' || m.text().includes('Content Security Policy')) && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
page.on('request', (r) => requests.push(r.url()))
page.on('dialog', (d) => d.accept())

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
  if (!ok) failed++
}

const row = (no) => page.locator(`tr[data-task-no="${no}"]`)
const cellInput = (no, col) => row(no).locator('td').nth(col).locator('input')
const header = async () => (await page.locator('thead th').allInnerTexts()).map((h) => h.trim())
const colIndex = async (label) => (await header()).findIndex((h) => h.toUpperCase().startsWith(label.toUpperCase()))
const lastNo = async () => Number(await page.locator('tbody tr').last().getAttribute('data-task-no'))

await page.goto(`${url}#/tasks`)
await page.waitForSelector('tbody tr')

const C = {
  name: await colIndex('Název'),
  duration: await colIndex('Doba'),
  start: await colIndex('Aktuální start'),
  finish: await colIndex('Aktuální konec'),
  preds: await colIndex('Předchůdci'),
  wbs: await colIndex('WBS'),
}

// Two new auto-scheduled tasks: A, then B = A FS+2d
await page.getByRole('button', { name: '+ Přidat úkol' }).click()
const a = await lastNo()
await cellInput(a, C.name).fill('Task A')
await cellInput(a, C.start).fill('2026-10-23') // Friday; sets "start no earlier than"
await page.getByRole('button', { name: '+ Přidat úkol' }).click()
const b = await lastNo()
await cellInput(b, C.name).fill('Task B')
await cellInput(b, C.preds).fill(`${a}FS+2d`)
await cellInput(b, C.preds).press('Enter')
await page.waitForTimeout(200)
check('FS+2d skips the weekend and the 28 Oct holiday', (await cellInput(b, C.start).inputValue()) === '2026-10-29', await cellInput(b, C.start).inputValue())

// Longer predecessor moves the successor (a separate undo step: edits closer
// than 800 ms are merged, like typing a word)
await page.waitForTimeout(900)
await cellInput(a, C.duration).fill('3')
await page.waitForTimeout(200)
check('predecessor finish follows its duration', (await cellInput(a, C.finish).inputValue()) === '2026-10-27', await cellInput(a, C.finish).inputValue())
check('successor is rescheduled automatically', (await cellInput(b, C.start).inputValue()) === '2026-11-02', await cellInput(b, C.start).inputValue())

// Undo restores the previous schedule
await page.locator('h2, thead').first().click()
await page.waitForTimeout(900) // separate undo step from the typing burst
await page.keyboard.press('Control+z')
await page.waitForTimeout(200)
check('undo restores the previous schedule', (await cellInput(b, C.start).inputValue()) === '2026-10-29', await cellInput(b, C.start).inputValue())

// Hierarchy: indent B under A -> A becomes a summary with rolled-up dates
await row(b).getByTitle(/Odsadit/).click()
await page.waitForTimeout(200)
const wbsB = await row(b).locator('td').nth(C.wbs).innerText()
check('indent creates a subtask (outline number)', /\.1$/.test(wbsB), wbsB)
check('summary shows rolled-up dates', (await row(a).locator('td').nth(C.start).locator('input').count()) === 0)

// XSS: a task name with markup must stay text in the Gantt
await cellInput(b, C.name).fill('<img src=x onerror="window.__xss=1">')
await page.waitForTimeout(300)
await page.locator('nav button', { hasText: 'Gantt' }).click()
await page.waitForSelector('[data-testid=gantt] .bar-wrapper')
await page.waitForTimeout(500)
check('task names are not executed as HTML in the Gantt', (await page.evaluate(() => window.__xss)) === undefined)
check('the name is shown as text', (await page.locator('.bar-label', { hasText: '<img' }).count()) === 1)
check('critical path is highlighted', (await page.locator('[data-testid=gantt] .bar-wrapper[class*="gx-crit"]').count()) > 0)
check('dependency arrows are drawn', (await page.locator('[data-testid=gantt] .arrow path').count()) > 5)
if (shots) await page.screenshot({ path: `${shots}/gantt.png` })

// Kanban: drag a card to "Done"
await page.locator('nav button', { hasText: 'Kanban' }).click()
const card = page.locator('[data-task-no="11"]')
const target = page.locator('section[data-status="Done"]')
await card.scrollIntoViewIfNeeded()
const from = await card.boundingBox()
const to = await target.boundingBox()
await page.mouse.move(from.x + 20, from.y + 10)
await page.mouse.down()
await page.mouse.move(from.x + 40, from.y + 20, { steps: 5 })
await page.mouse.move(to.x + 40, to.y + 60, { steps: 20 })
await page.mouse.up()
await page.waitForTimeout(300)
check('dragging a card changes its status', (await target.locator('[data-task-no="11"]').count()) === 1)
if (shots) await page.screenshot({ path: `${shots}/board.png` })

check('only the HTML file was loaded', requests.length === 1, requests.join(', '))
check('no console errors or CSP violations', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
