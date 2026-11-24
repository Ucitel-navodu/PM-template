// E2E: v0.12 – the eye (hide for suppliers) on screen and in exports, bulk edit of selected tasks,
// column order by dragging, status icons. Portable build via file:// (Europe/Prague).
// Usage: node tests/e2e/supplier.mjs [path-to-index.html] [output-dir]
import { chromium } from 'playwright'
import { resolve, join } from 'node:path'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

const url = `file://${resolve(process.argv[2] ?? 'dist-portable/index.html')}`
const out = process.argv[3] ?? mkdtempSync(join(tmpdir(), 'pm-supplier-'))
mkdirSync(out, { recursive: true })

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const ctx = await browser.newContext({ timezoneId: 'Europe/Prague', locale: 'cs-CZ', viewport: { width: 1600, height: 950 }, acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => (m.type() === 'error' || m.text().includes('Content Security Policy')) && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept())

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
  if (!ok) failed++
}
const tab = (name) => page.locator('nav button', { hasText: name }).first().click()
const navTexts = async () => (await page.locator('nav button').allInnerTexts()).map((t) => t.trim())
const zipText = (file) =>
  execFileSync('python3', ['-I', '-c', 'import sys,re,zipfile;z=zipfile.ZipFile(sys.argv[1]);print(" ".join(" ".join(re.findall(r"<a:t>([^<]*)</a:t>|<t[^>]*>([^<]*)</t>|<sheet name=\\"([^\\"]+)\\"",z.read(n).decode()) and [x for t in re.findall(r"<a:t>([^<]*)</a:t>|<t[^>]*>([^<]*)</t>|<sheet name=\\"([^\\"]+)\\"",z.read(n).decode()) for x in t if x]) for n in z.namelist() if n.endswith(".xml")))', file], { encoding: 'utf8', maxBuffer: 1e8 })
const download = async (trigger, name) => {
  const [dl] = await Promise.all([page.waitForEvent('download'), trigger()])
  const file = join(out, name ?? dl.suggestedFilename())
  await dl.saveAs(file)
  return file
}

await page.goto(`${url}#/dashboard`)
await page.waitForSelector('nav button')

// ---------------------------------------------------------------- the eye
check('the eye is in the header and off by default', (await page.getByTestId('sensitive-toggle').getAttribute('aria-pressed')) === 'false')
check('Budget, Changes and History tabs are there', ['Rozpočet', 'Změny', 'Historie'].every((t) => navTexts().then((n) => n.includes(t))))
await page.getByTestId('sensitive-toggle').click()
const nav = await navTexts()
check('eye on: Budget, Changes and History tabs are hidden', !nav.includes('Rozpočet') && !nav.includes('Změny') && !nav.includes('Historie'), nav.join(','))
check('eye on: a banner says what is hidden', await page.getByTestId('sensitive-banner').isVisible())
const dash = await page.locator('main').innerText()
check('eye on: no money on the dashboard', !/Kč|CZK/.test(dash) && !dash.includes('Rozpočet'), dash.match(/.{0,30}Kč.{0,10}/)?.[0])
await page.goto(`${url}#/budget`)
await page.waitForSelector('nav button')
check('a hidden tab opened by its address shows the dashboard', (await page.locator('nav button[aria-current=page]').innerText()).includes('Dashboard'))
await page.reload()
await page.waitForSelector('nav button')
check('the eye survives a reload', (await page.getByTestId('sensitive-toggle').getAttribute('aria-pressed')) === 'true')

await tab('Milníky')
check('eye on: milestones without payments and invoices', !/Kč|Faktura|Platba/i.test(await page.locator('main table').innerText()))
await tab('RAID')
check('eye on: risks without mitigation columns', !(await page.locator('main thead').innerText()).includes('Opatření'))
await tab('Úkoly')
await page.waitForSelector('tbody tr[data-task-no]')
check('eye on: no notes column in tasks', (await page.locator('thead th[data-col=notes]').count()) === 0)

await tab('Report')
await page.waitForSelector('[data-testid=report]')
const rep = await page.getByTestId('report').innerText()
check('eye on: report without costs, budget and change requests', !/Kč/.test(rep) && !rep.includes('CR-002') && !rep.includes('Zapojit management'), rep.match(/.{0,30}(Kč|CR-002).{0,10}/)?.[0])
const deck = await download(() => page.getByRole('button', { name: /Stáhnout PPTX/ }).click(), 'supplier.pptx')
const deckText = zipText(deck)
check('eye on: PPTX without money, budget slide and change requests', !/Kč|CZK/.test(deckText) && !deckText.includes('Rozpočet') && !deckText.includes('CR-002') && deckText.includes('Registr rizik'), deckText.match(/.{0,30}(Kč|CR-002|Rozpočet).{0,10}/)?.[0])
await page.getByRole('button', { name: /Soubor/ }).click()
const xlsx = await download(() => page.getByRole('button', { name: /Export do Excelu/ }).click(), 'supplier.xlsx')
const xlsxText = zipText(xlsx)
check('eye on: Excel without BUDGET / CHANGES sheets and money columns', !xlsxText.includes('BUDGET') && !xlsxText.includes('CHANGES') && !xlsxText.includes('Amount') && !xlsxText.includes('Mitigation') && xlsxText.includes('TASKS'))

await page.getByTestId('sensitive-toggle').click()
check('eye off: everything is back', (await navTexts()).includes('Rozpočet') && !(await page.getByTestId('sensitive-banner').count()))

// ---------------------------------------------------------------- bulk edit
await tab('Úkoly')
await page.waitForSelector('tbody tr[data-task-no]')
const statusOf = (no) => page.locator(`tr[data-task-no="${no}"] td[data-col-cell=status] select, tr[data-task-no="${no}"] select`).nth(1).inputValue()
await page.getByTestId('select-mode').click()
await page.locator('tr[data-task-no="10"] [data-select]').click()
await page.locator('tr[data-task-no="12"] [data-select]').click({ modifiers: ['Shift'] })
const bulk = page.getByTestId('bulk-edit')
await bulk.getByLabel('Atribut').selectOption('status')
await bulk.getByLabel('Hodnota').selectOption('On hold')
await page.getByTestId('bulk-apply').click()
await page.waitForTimeout(200)
const heads = await page.locator('thead th').evaluateAll((t) => t.map((x) => x.dataset.col))
const statusCol = heads.indexOf('status')
const st = async (no) => page.locator(`tr[data-task-no="${no}"] td`).nth(statusCol).locator('select').inputValue()
check('bulk edit sets the status of the 3 selected tasks', (await st(10)) === 'On hold' && (await st(11)) === 'On hold' && (await st(12)) === 'On hold' && (await st(13)) !== 'On hold', [await st(10), await st(11), await st(12), await st(13)].join())
await bulk.getByLabel('Atribut').selectOption('mgmtExport')
await bulk.getByLabel('Hodnota').selectOption('true')
await page.getByTestId('bulk-apply').click()
await page.mouse.click(3, 300)
await page.keyboard.press('Control+z')
await page.waitForTimeout(200)
check('Ctrl+Z undoes one bulk step (the status stays)', (await st(10)) === 'On hold')
await page.keyboard.press('Control+z')
await page.waitForTimeout(200)
check('…and the next Ctrl+Z the status change', (await st(10)) !== 'On hold', await st(10))
await page.getByTestId('select-mode').click()

// ---------------------------------------------------------------- column order
const order = async () => (await page.locator('thead th').evaluateAll((t) => t.map((x) => x.dataset.col))).filter((c) => ['name', 'owner', 'status'].includes(c)).join(',')
const before = await order()
await page.locator('thead th[data-col=owner]').dragTo(page.locator('thead th[data-col=name]'), { targetPosition: { x: 5, y: 10 } })
await page.waitForTimeout(200)
const after = await order()
check('dragging the Owner header puts it before Name', after.startsWith('owner,name'), `${before} -> ${after}`)
check('the row tools stay the first column', (await page.locator('thead th').first().getAttribute('data-col')) === 'actions')
await page.reload()
await page.waitForSelector('tbody tr[data-task-no]')
check('the column order survives a reload', (await order()) === after, await order())
await page.getByRole('button', { name: /Sloupce/ }).click()
await page.getByTestId('reset-column-order').click()
check('the order can be reset', (await order()) === before, await order())

// ---------------------------------------------------------------- status icons
await page.getByRole('button', { name: 'Nastavení' }).click()
await page.locator('[data-settings-nav=statuses]').click()
await page.locator('[data-icon-picker]').nth(1).click()
const picker = page.getByTestId('icon-picker')
check('icon picker groups the icons by category', (await picker.innerText()).toLowerCase().includes('čekání a blokace') && (await picker.locator('[data-icon]').count()) >= 80)
await picker.locator('[data-icon="🚀"]').click()
check('the picked icon is shown for the status', (await page.locator('[data-icon-picker]').nth(1).innerText()).includes('🚀'))
await page.keyboard.press('Escape')
await tab('Kanban')
check('Kanban shows the new icon', (await page.locator('main').innerText()).includes('🚀 In progress'))
await tab('Úkoly')
check('the status list in tasks shows the new icon', (await page.locator('tbody select option', { hasText: 'In progress' }).first().innerText()).includes('🚀'))

check('no console errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
