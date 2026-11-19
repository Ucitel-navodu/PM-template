// E2E: v0.9 – colleague feedback (typing keeps focus, column widths, drag & drop, row tools first),
// CAPEX/OPEX, links, settings panels + deep links, working file as .xlsx, import of the original template.
// Usage: node tests/e2e/feedback.mjs [dist-dir] [screenshot-dir]
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const html = readFileSync(resolve(process.argv[2] ?? 'dist-portable', 'index.html'))
const shots = process.argv[3]
if (shots) mkdirSync(shots, { recursive: true })
const server = createServer((_, res) => res.writeHead(200, { 'content-type': 'text/html' }).end(html)).listen(0)
const url = `http://localhost:${server.address().port}/`

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const ctx = await browser.newContext({ timezoneId: 'Europe/Prague', locale: 'cs-CZ', viewport: { width: 1600, height: 950 } })
await ctx.addInitScript(() => {
  // native pickers -> a handle in the Origin Private File System (same FileSystemFileHandle API)
  const handle = async () => (await navigator.storage.getDirectory()).getFileHandle('ws.xlsx', { create: true })
  window.showSaveFilePicker = handle
  window.showOpenFilePicker = async () => [await handle()]
})
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Nový' : undefined))

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
  if (!ok) failed++
}
const tab = (name) => page.locator('nav button', { hasText: name }).first().click()
const order = async () => (await page.locator('tbody tr[data-task-no]').evaluateAll((r) => r.map((x) => x.dataset.taskNo))).join(',')

await page.goto(`${url}#/tasks`)
await page.waitForSelector('tbody tr[data-task-no]')
const heads = (await page.locator('thead th').evaluateAll((t) => t.map((x) => x.dataset.col)))
check('row tools are the first column', heads[0] === 'actions', heads.slice(0, 4).join())

// 1) typing: the field keeps focus for the whole text (the bug: one letter, then focus lost)
const name = page.locator('tr[data-task-no="2"] td').nth(heads.indexOf('name')).locator('input')
await name.click()
await name.press('End')
await page.keyboard.type(' – dlouhý název úkolu', { delay: 25 })
check('task name: typing keeps focus', (await name.evaluate((e) => document.activeElement === e)) && (await name.inputValue()).endsWith(' – dlouhý název úkolu'), await name.inputValue())
await name.press('Enter')
const owner = page.locator('tr[data-task-no="2"] td').nth(heads.indexOf('owner')).locator('input')
await owner.click()
await owner.fill('')
await page.keyboard.type('Bartoloměj Dlouhopříjmený', { delay: 20 })
check('owner: typing keeps focus', (await owner.inputValue()) === 'Bartoloměj Dlouhopříjmený' && (await owner.evaluate((e) => document.activeElement === e)))
await owner.press('Enter')
check('full text is available as a tooltip', (await owner.getAttribute('title')) === 'Bartoloměj Dlouhopříjmený')

// 2) column width by dragging, kept after reload
await page.locator('table').evaluate((t) => (t.parentElement.scrollLeft = 0))
const th = page.locator('thead th[data-col="name"]')
const w0 = (await th.boundingBox()).width
const rb = await th.locator('[data-resizer]').boundingBox()
await page.mouse.move(rb.x + rb.width / 2, rb.y + 5)
await page.mouse.down()
await page.mouse.move(rb.x + 160, rb.y + 5, { steps: 6 })
await page.mouse.up()
const w1 = (await th.boundingBox()).width
check('column can be widened by dragging', w1 > w0 + 120, `${w0} -> ${w1}`)
await page.reload()
await page.waitForSelector('tbody tr[data-task-no]')
check('column width survives a reload', Math.abs((await th.boundingBox()).width - w1) < 2)
check('edited name was saved', (await name.inputValue()).endsWith('dlouhý název úkolu'))

// 3) drag & drop reorder, one undo step
const before = await order()
const hb = await page.locator('tr[data-task-no="5"] [data-drag-handle]').boundingBox()
const tb = await page.locator('tr[data-task-no="2"]').boundingBox()
await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
await page.mouse.down()
await page.mouse.move(hb.x + 8, hb.y - 8, { steps: 4 })
await page.mouse.move(tb.x + 80, tb.y + 6, { steps: 15 })
await page.waitForTimeout(100)
check('an insertion line shows where the task lands (above the row)', (await page.locator('tr[data-task-no="2"]').getAttribute('data-drop')) === 'before')
await page.mouse.move(tb.x + 80, tb.y + tb.height - 5, { steps: 4 })
await page.waitForTimeout(100)
check('…and below the row in its lower half', (await page.locator('tr[data-task-no="2"]').getAttribute('data-drop')) === 'after')
if (shots) await page.screenshot({ path: `${shots}/drag-line.png` })
await page.mouse.move(tb.x + 80, tb.y + 6, { steps: 4 })
await page.mouse.up()
await page.waitForTimeout(300)
const after = await order()
const a = after.split(',')
check('drag & drop moves the task before the drop target', after !== before && a.indexOf('5') === a.indexOf('2') - 1, `${before} -> ${after}`)
check('the line disappears after the drop', (await page.locator('tr[data-drop]').count()) === 0)
await page.mouse.click(3, 300)
await page.keyboard.press('Control+z')
await page.waitForTimeout(200)
check('Ctrl+Z reverts the move', (await order()) === before, await order())

// 3b) the table scrolls inside its own box: header and horizontal scrollbar stay within reach
await page.setViewportSize({ width: 1600, height: 620 })
const box = await page.getByTestId('tasks-scroll').evaluate((w) => {
  w.scrollTop = 200
  const th = w.querySelector('thead th[data-col="name"]').getBoundingClientRect()
  const r = w.getBoundingClientRect()
  const out = { fits: r.height <= innerHeight, scrolls: w.scrollHeight > w.clientHeight, headerStuck: Math.abs(th.top - r.top) < 3, wide: w.scrollWidth > w.clientWidth }
  w.scrollTop = 0
  return out
})
await page.setViewportSize({ width: 1600, height: 950 })
check('long task list scrolls inside the table box with a sticky header', box.fits && box.scrolls && box.headerStuck && box.wide, JSON.stringify(box))

// 3c) selection mode: bulk delete in one undo step
const n0 = await page.locator('tbody tr[data-task-no]').count()
check('no checkboxes until selection mode is on', (await page.locator('[data-select]').count()) === 0)
await page.getByTestId('select-mode').click()
await page.locator('tr[data-task-no="14"] [data-select]').click()
await page.locator('tr[data-task-no="16"] [data-select]').click({ modifiers: ['Shift'] })
check('Shift+click selects a range', (await page.getByTestId('select-bar').innerText()).includes('Vybráno: 3'), await page.getByTestId('select-bar').innerText())
await page.getByTestId('delete-selected').click()
await page.waitForTimeout(200)
check('selected tasks are deleted and the mode switches off', (await page.locator('tbody tr[data-task-no]').count()) === n0 - 3 && (await page.locator('[data-select]').count()) === 0)
await page.mouse.click(3, 300)
await page.keyboard.press('Control+z')
await page.waitForTimeout(200)
check('Ctrl+Z brings them all back', (await page.locator('tbody tr[data-task-no]').count()) === n0)

// 4) add a subtask from the row
const count = await page.locator('tbody tr[data-task-no]').count()
check('row tools column is narrow', (await page.locator('thead th[data-col="actions"]').boundingBox()).width < 100)
await page.locator('tr[data-task-no="5"] [data-row-menu]').click()
const menu = page.getByTestId('row-menu')
const labels = (await menu.getByRole('menuitem').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim())
check('⋯ opens a menu with labelled actions', labels.length === 7 && labels[1].includes('Přidat podúkol') && labels[2].includes('Odsadit') && labels[6].includes('Smazat'), labels.join(' | '))
const mb = await menu.boundingBox()
const wb = await page.getByTestId('tasks-scroll').boundingBox()
check('the menu is not clipped by the table and stays in the window', mb.height > 200 && mb.y + mb.height <= 950 && mb.x >= wb.x, JSON.stringify(mb))
if (shots) await page.screenshot({ path: `${shots}/row-menu.png` })
await page.keyboard.press('Escape')
check('Esc closes the menu', (await menu.count()) === 0)
await page.locator('tr[data-task-no="5"] td').nth(heads.indexOf('wbs')).click({ button: 'right' })
check('right click on a row opens the same menu', (await menu.getByRole('menuitem').count()) === 7)
await page.keyboard.press('ArrowDown')
check('arrow keys move in the menu', (await page.evaluate(() => document.activeElement?.getAttribute('data-menu-item'))) === 'add-subtask')
await page.keyboard.press('Enter')
await page.waitForTimeout(200)
const wbs = await page.locator('tr[data-task-no="5"] + tr td').nth(heads.indexOf('wbs')).innerText()
check('＋ subtask adds a child right under the task', (await page.locator('tbody tr[data-task-no]').count()) === count + 1 && /\.1$/.test(wbs.trim()), wbs)

// 5) narrow screens: no sideways page scroll, row tools stay visible
for (const w of [1280, 1024, 768]) {
  await page.setViewportSize({ width: w, height: 900 })
  await page.waitForTimeout(150)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  check(`${w}px: the page does not scroll sideways`, over <= 0, String(over))
  if (shots) await page.screenshot({ path: `${shots}/tasks-${w}.png` })
}
await page.locator('table').evaluate((t) => (t.parentElement.scrollLeft = 600))
const sticky = await page.locator('tr[data-task-no="2"] [data-drag-handle]').boundingBox()
const wrap = await page.locator('table').evaluate((t) => t.parentElement.getBoundingClientRect().left)
check('row tools stay visible when the table scrolls', sticky.x >= wrap && sticky.x < wrap + 60, `${sticky.x} vs ${wrap}`)
await page.setViewportSize({ width: 1600, height: 950 })

// 6) settings: deep link opens just the Phases panel; menu + search
await page.getByRole('button', { name: /Fáze projektu/ }).click()
const dlg = page.getByRole('dialog')
check('"Fáze projektu" opens the Phases panel only', (await dlg.locator('[data-settings-panel]').getAttribute('data-settings-panel')) === 'phases' && (await dlg.getByRole('radiogroup').count()) === 0 && (await dlg.locator('[data-settings-panel] section').count()) === 1)
if (shots) await page.screenshot({ path: `${shots}/settings-phases.png` })
await dlg.getByRole('searchbox').fill('svátky')
check('search narrows the menu', (await dlg.locator('[data-settings-nav]').count()) === 1 && (await dlg.locator('[data-settings-nav=calendar]').count()) === 1)
await dlg.getByRole('searchbox').press('Enter')
check('Enter opens the found panel', (await dlg.locator('[data-settings-panel]').getAttribute('data-settings-panel')) === 'calendar')
check('menu lists all 10 panels again', (await dlg.locator('[data-settings-nav]').count()) === 10)
await page.keyboard.press('Escape')

// 7) budget: CAPEX / OPEX
await tab('Rozpočet')
const rows = page.locator('tbody tr')
await rows.nth(0).getByLabel('CAPEX / OPEX').selectOption('CAPEX')
await rows.nth(1).getByLabel('CAPEX / OPEX').selectOption('OPEX')
const split = await page.getByTestId('capex-opex').innerText()
check('budget shows CAPEX and OPEX totals', /CAPEX · Forecast 100\s000/.test(split) && /OPEX · Forecast 50\s000/.test(split), split.replace(/\s+/g, ' '))
await page.getByTestId('capex-opex').locator('select').selectOption('CAPEX')
check('filter by cost type', (await rows.count()) === 1)
await page.getByTestId('budget-categories').click()
check('budget deep link opens the categories panel', (await dlg.locator('[data-settings-panel]').getAttribute('data-settings-panel')) === 'budget')
await page.keyboard.press('Escape')

// 8) dashboard: links (only http/https become links) + CAPEX/OPEX
await tab('Dashboard')
const links = page.getByTestId('links-card')
await links.getByRole('button', { name: /Upravit/ }).click()
await links.getByLabel('Clarity URL').fill('https://clarity.example.com/p/42')
await links.getByLabel('SharePoint URL').fill('javascript:alert(1)')
await links.getByRole('button', { name: 'Hotovo' }).click()
const hrefs = await links.locator('a').evaluateAll((x) => x.map((e) => `${e.getAttribute('href')}|${e.target}|${e.rel}`))
check('a valid link opens in a new window; a script URL is not a link', hrefs.join() === 'https://clarity.example.com/p/42|_blank|noopener noreferrer', hrefs.join())
check('dashboard shows the CAPEX / OPEX split', /CAPEX:\s*100\s000/.test(await page.locator('main').innerText()))
if (shots) await page.screenshot({ path: `${shots}/dashboard.png`, fullPage: true })

// 9) working file as .xlsx: save, autosave, reopen
await page.getByRole('button', { name: /Soubor/ }).click()
await page.getByRole('button', { name: 'Uložit do souboru…' }).last().click()
check('four formats are offered', (await page.locator('[data-format]').count()) === 4)
await page.locator('[data-format=xlsx]').click()
if (shots) await page.screenshot({ path: `${shots}/save-as.png` })
await page.getByTestId('saveas-confirm').click()
await page.waitForFunction(() => document.querySelector('[data-testid=sync-status]')?.getAttribute('data-status') === 'saved')
const fileBytes = () => page.evaluate(async () => Array.from(new Uint8Array(await (await (await (await navigator.storage.getDirectory()).getFileHandle('ws.xlsx')).getFile()).arrayBuffer())))
const tmp = resolve(process.env.TMPDIR ?? '/tmp', `pm-ws-${Date.now()}.xlsx`)
const sheetsOf = async () => {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(tmp, Buffer.from(await fileBytes()))
  return execFileSync('python3', ['-I', '-c', 'import sys,zipfile,re;z=zipfile.ZipFile(sys.argv[1]);print(",".join(n+("*" if "veryHidden" in s else "") for n,s in re.findall(r\'<sheet name="([^"]+)"([^>]*)>\',z.read("xl/workbook.xml").decode())))', tmp], { encoding: 'utf8' }).trim()
}
check('the file is a real workbook with readable sheets and a hidden data sheet', (await sheetsOf()) === 'README,TASKS,MILESTONES,BUDGET,RISKS,CHANGES,CONFIG,PM_DATA*', await sheetsOf())
await tab('Portfolio')
await page.getByRole('button', { name: /Nový projekt/ }).click()
await page.waitForTimeout(3000)
check('edits are autosaved into the .xlsx', (await page.getByTestId('sync-status').getAttribute('data-status')) === 'saved' && (await page.locator('select[aria-label] option').count()) === 2)
// disconnect, change the data in the browser, then open the workbook again
await page.getByRole('button', { name: /Soubor/ }).click()
await page.getByRole('button', { name: /Odpojit/ }).click()
await tab('Portfolio')
await page.getByRole('button', { name: /Nový projekt/ }).click()
await page.waitForTimeout(300)
check('(3 projects in the browser before opening the file)', (await page.locator('select[aria-label] option').count()) === 3)
await page.getByRole('button', { name: /Soubor/ }).click()
await page.getByRole('button', { name: 'Otevřít soubor…' }).click()
await page.waitForFunction(() => document.querySelector('[data-testid=sync-status]')?.getAttribute('data-status') === 'saved')
check('opening the .xlsx restores every project', (await page.locator('select[aria-label] option').count()) === 2, String(await page.locator('select[aria-label] option').count()))
await page.locator('select[aria-label]').first().selectOption({ index: 0 })
await tab('Dashboard')
check('…including links and CAPEX/OPEX', (await page.getByTestId('links-card').locator('a').count()) === 1 && /CAPEX:\s*100\s000/.test(await page.locator('main').innerText()))

// 10) import of the original Excel template (.xlsm: titles above the header row, DASHBOARD card)
const xlsm = execFileSync('python3', ['-I', '-c', `
import sys,zipfile,io
def sheet(rows):
    out=''
    for r,row in enumerate(rows,1):
        out+='<row r="%d">'%r+''.join('<c r="%s%d" t="inlineStr"><is><t>%s</t></is></c>'%(chr(65+c),r,v) for c,v in enumerate(row) if v!='')+'</row>'
    return '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+out+'</sheetData></worksheet>'
names=['DASHBOARD','TASKS','BUDGET']
data=[[['PROJECT DASHBOARD'],['Project Name','','Migrace ERP'],['ITPM','','Eva Malá']],
      [['TASKS – plan'],[''],['ID','Task Name','Owner','Current Start','Current Finish','Status'],['1','Analýza ERP','Eva','2.3.2026','6.3.2026','In progress'],['2','Migrace dat','Petr','9.3.2026','20.3.2026','Not started']],
      [['BUDGET'],['ID','Category','Capex/Opex','Description','Planned'],['X1','HW/SW','CAPEX','Licence ERP','750000']]]
b=io.BytesIO(); z=zipfile.ZipFile(b,'w')
z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+''.join('<sheet name="%s" sheetId="%d" r:id="rId%d"/>'%(n,i+1,i+1) for i,n in enumerate(names))+'</sheets></workbook>')
z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+''.join('<Relationship Id="rId%d" Target="worksheets/sheet%d.xml"/>'%(i+1,i+1) for i in range(3))+'</Relationships>')
z.writestr('xl/vbaProject.bin',b'macro')
for i,d in enumerate(data): z.writestr('xl/worksheets/sheet%d.xml'%(i+1),sheet(d))
z.close(); sys.stdout.buffer.write(b.getvalue())`], { maxBuffer: 1e7 })
await page.getByRole('button', { name: /Soubor/ }).click()
await page.getByRole('button', { name: /Import \(MS Project/ }).click()
await page.getByTestId('import-file').setInputFiles({ name: 'Project_Manager_Template.xlsm', mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12', buffer: xlsm })
await page.getByTestId('import-review').waitFor()
await page.getByRole('dialog').locator('select').selectOption('new')
const review = await page.getByTestId('import-review').innerText()
check('.xlsm: tasks under title rows, budget and project card are recognised', review.includes('Migrace dat') && review.includes('Licence ERP') && review.includes('Migrace ERP'), review.replace(/\s+/g, ' ').slice(0, 300))
await page.getByRole('button', { name: /^Importovat/ }).click()
await page.getByRole('dialog').getByRole('status').waitFor()
await page.getByRole('button', { name: /Zavřít|Zrušit/ }).last().click()
check('imported project uses the name from the workbook', (await page.locator('main').innerText()).includes('Migrace ERP') && (await page.locator('main').innerText()).includes('Eva Malá'))

check('no console errors', errors.length === 0, errors.join(' | '))
await browser.close()
server.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
