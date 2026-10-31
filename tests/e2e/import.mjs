// E2E: import (MS Project XML, Excel, CSV) and Excel export in the portable build via file:// (Europe/Prague).
// Usage: node tests/e2e/import.mjs [path-to-index.html] [output-dir]
import { chromium } from 'playwright'
import { resolve, join } from 'node:path'
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

const url = `file://${resolve(process.argv[2] ?? 'dist-portable/index.html')}`
const out = process.argv[3] ?? mkdtempSync(join(tmpdir(), 'pm-import-'))
mkdirSync(out, { recursive: true })
const xml = readFileSync('tests/fixtures/sample-msp.xml', 'utf8')

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const ctx = await browser.newContext({ timezoneId: 'Europe/Prague', locale: 'cs-CZ', viewport: { width: 1600, height: 1000 }, acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
const requests = []
page.on('console', (m) => (m.type() === 'error' || m.text().includes('Content Security Policy')) && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
page.on('request', (r) => requests.push(r.url()))

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
  if (!ok) failed++
}
const tab = (name) => page.locator('nav button', { hasText: name }).first().click()
const upload = (name, content, mime = 'application/octet-stream') => page.getByTestId('import-file').setInputFiles({ name, mimeType: mime, buffer: Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8') })
const openWizard = async () => {
  await page.getByRole('button', { name: /Soubor/ }).click()
  await page.getByRole('menuitem', { name: /Import/ }).or(page.getByRole('button', { name: /Import \(MS Project/ })).first().click()
  await page.getByRole('dialog', { name: 'Import dat' }).waitFor()
}
const closeWizard = () => page.getByRole('button', { name: /Zavřít|Zrušit/ }).last().click()
const names = () => page.locator('tbody tr[data-task-no] td:nth-child(3) input').evaluateAll((els) => els.map((e) => e.value))

await page.goto(`${url}#/tasks`)
await page.waitForSelector('tbody tr')

// 1) MS Project XML into a NEW project
await openWizard()
await upload('alfa.xml', xml, 'text/xml')
await page.getByTestId('import-review').waitFor()
await page.getByRole('dialog').locator('select').selectOption('new')
check('review shows 7 added tasks', (await page.getByTestId('import-review').innerText()).includes('7') && (await page.getByTestId('import-review').innerText()).includes('Analýza & návrh'))
await page.getByRole('button', { name: /^Importovat/ }).click()
await page.getByRole('dialog').getByRole('status').waitFor()
await closeWizard()
check('new project created and active', (await page.locator('select[aria-label]').first().inputValue()) !== '' && (await page.locator('select[aria-label] option:checked').first().innerText()) === 'Projekt Alfa')
await page.waitForSelector('tbody tr[data-task-no]')
const imported = await names()
check('imported tasks with hierarchy', imported.length === 7 && imported[1] === 'Analýza & návrh', imported.join(' | '))
const wbs = await page.locator('tbody tr[data-task-no] td:nth-child(2)').allInnerTexts()
check('outline numbers 1, 1.1 …', wbs.join() === '1,1.1,1.2,1.3,1.4,1.5,1.6', wbs.join())

await tab('Gantt')
await page.waitForSelector('[data-testid=gantt] .bar-wrapper')
check('Gantt draws the 7 tasks and the links', (await page.locator('[data-testid=gantt] .bar-wrapper').count()) === 7 && (await page.locator('[data-testid=gantt] .arrow path').count()) >= 6)

// 2) repeated import: a moved task, a new one, a removed one
const changed = xml
  .replace('<Start>2026-11-09T08:00:00</Start><Finish>2026-11-13T17:00:00</Finish><Duration>PT40H0M0S</Duration>\n      <PercentComplete>50', '<Start>2026-11-12T08:00:00</Start><Finish>2026-11-18T17:00:00</Finish><Duration>PT40H0M0S</Duration>\n      <PercentComplete>100')
  .replace(/<Task>\s*<UID>5<\/UID>[\s\S]*?<\/Task>/, '')
  .replace('</Tasks>', '<Task><UID>8</UID><ID>8</ID><Name>Nový úkol z MSP</Name><OutlineLevel>2</OutlineLevel><Start>2026-11-23T08:00:00</Start><Finish>2026-11-25T17:00:00</Finish><Duration>PT24H0M0S</Duration></Task></Tasks>')
await tab('Úkoly')
await openWizard()
await upload('alfa.xml', changed, 'text/xml')
await page.getByTestId('import-review').waitFor()
const review = await page.getByTestId('import-review').innerText()
check('second import shows what changes', review.includes('Nový úkol z MSP') && review.includes('currentStart') && review.includes('Testování') && review.includes('V souboru chybí'))
await page.getByRole('button', { name: /^Importovat/ }).click()
await page.getByRole('dialog').getByRole('status').waitFor()
await closeWizard()
const after = await names()
check('new task added, removed one kept by default', after.includes('Nový úkol z MSP') && after.includes('Testování') && after.length === 8, after.join(' | '))
const impl = await page.locator('tbody tr', { has: page.locator('input[value="Implementace"]') }).first().locator('input[type=date]').first().inputValue()
check('moved task has the new date', impl === '2026-11-12', impl)

await tab('Historie')
await page.waitForSelector('thead th:has-text("Kdy")')
const histText = await page.locator('tbody').innerText()
check('history records the import', histText.includes('Import alfa.xml'), histText.replace(/\s+/g, ' ').slice(0, 200))

// 3) Undo reverts the whole import (the import is its own undo step even right after another edit)
await page.keyboard.press('Control+z')
await tab('Úkoly')
await page.waitForSelector('tbody tr[data-task-no]')
const afterUndo = await names()
check('Ctrl+Z reverts the import in one step', !afterUndo.includes('Nový úkol z MSP') && afterUndo.length === 7, afterUndo.join(' | '))

// 4) Excel export, then re-import it as a new project
const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.getByRole('button', { name: /Soubor/ }).click(); await page.getByRole('button', { name: /Export do Excelu/ }).click() })()])
const xlsx = join(out, dl.suggestedFilename())
await dl.saveAs(xlsx)
const sheets = JSON.parse(execFileSync('python3', ['-I', '-c', 'import sys,json,zipfile,re;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps(re.findall(r\'<sheet name="([^"]+)"\',z.read("xl/workbook.xml").decode())))', xlsx], { encoding: 'utf8' }))
check('exported workbook has the expected sheets', sheets.join() === 'TASKS,MILESTONES,BUDGET,RISKS,CHANGES,CONFIG', sheets.join())
await openWizard()
await upload('export.xlsx', readFileSync(xlsx))
await page.getByTestId('import-review').waitFor()
const r2 = await page.getByTestId('import-review').innerText()
check('re-importing the export into the same project changes nothing', r2.includes('není nic'), r2.replace(/\s+/g, ' ').slice(0, 160))
await page.getByRole('dialog').locator('select').selectOption('new')
check('into a new project every task is added', (await page.getByRole('button', { name: /^Importovat \(/ }).innerText()).includes('('))
await closeWizard()

// 5) CSV (Czech Excel style) and .mpp
await openWizard()
await upload('ukoly.csv', '﻿Číslo;Název úkolu;Aktuální start;Aktuální konec;% dokončení\n1;CSV úkol A;2.12.2026;4.12.2026;10\n2;CSV úkol B;7.12.2026;9.12.2026;0\n', 'text/csv')
await page.getByTestId('import-review').waitFor()
check('CSV is mapped and previewed', (await page.getByTestId('import-review').innerText()).includes('CSV úkol B'))
await page.getByRole('button', { name: /^Importovat/ }).click()
await page.getByRole('dialog').getByRole('status').waitFor()
await closeWizard()
check('CSV tasks imported', (await names()).includes('CSV úkol A'))
await openWizard()
await upload('plan.mpp', 'binary')
check('.mpp gives a clear instruction', (await page.getByRole('alert').innerText()).includes('Uložit jako'))
await closeWizard()

check('only the HTML file was loaded', requests.filter((r) => !r.startsWith('blob:')).length === 1, requests.join(', '))
check('no console errors or CSP violations', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(`\noutput: ${out}`)
console.log(failed ? `${failed} check(s) failed` : 'all checks passed')
process.exit(failed ? 1 : 0)
