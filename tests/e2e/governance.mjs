// E2E: governance features (RAID, change requests, audit trail, custom statuses)
// of the portable build via file:// (Europe/Prague).
// Usage: node tests/e2e/governance.mjs [path-to-index.html] [screenshot-dir]
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
const tab = (name) => page.locator('nav button', { hasText: name }).first().click()

await page.goto(`${url}#/dashboard`)
await page.waitForSelector('nav button')

// Who am I (recorded in the audit trail and as the decision maker)
await page.getByRole('button', { name: 'Nastavení' }).click()
await page.getByPlaceholder('např. Jan Novák').fill('Jana Testová')
await page.keyboard.press('Escape')

// Health of task #1 before renaming its status
await tab('Úkoly')
const healthBefore = await page.locator('tr[data-task-no="1"] td').last().locator('..').innerText()

// RAID: add an issue, filter by the heat map
await tab('RAID')
await page.getByRole('tab', { name: /Issues/ }).click()
await page.getByRole('button', { name: /\+ Přidat/ }).click()
const newIssue = page.locator('tr[data-raid-id="R-006"]')
check('a new issue is added on the Issues tab', (await newIssue.count()) === 1)
await newIssue.locator('input').first().fill('Chybí testovací prostředí')
await page.getByRole('tab', { name: /Vše/ }).click()
await page.locator('[data-cell="High-Medium"]').click()
const filtered = await page.locator('tbody tr[data-raid-id]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-raid-id')))
check('heat map cell filters the register', filtered.join() === 'R-002', filtered.join())
await page.locator('[data-cell="High-Medium"]').click()

// Change request approval: re-baseline + decision in RAID + budget
await tab('Změny')
await page.locator('tr[data-cr-id="CR-002"]').getByRole('button', { name: 'Schválit' }).click()
await page.waitForTimeout(200)
const crRow = await page.locator('tr[data-cr-id="CR-002"]').innerText()
check('CR is approved by the current user', crRow.includes('Jana Testová'), crRow.replace(/\s+/g, ' ').slice(0, 120))
const budgetCard = await page.getByText('Aktuální rozpočet').locator('..').innerText()
check('approved CR raises the current budget', budgetCard.replace(/\s/g, '').includes('46800000'), budgetCard)
if (shots) await page.screenshot({ path: `${shots}/changes.png` })

await tab('RAID')
await page.getByRole('tab', { name: /Rozhodnutí/ }).click()
check('approval is logged as a decision in RAID', (await page.locator('tbody tr', { hasText: 'CR-002' }).count()) === 1)
if (shots) await page.screenshot({ path: `${shots}/raid.png` })

await tab('Úkoly')
await page.getByRole('button', { name: /Baseline/ }).click()
check('approval saved a new baseline', (await page.getByRole('dialog').getByText(/CR-002/).count()) === 1)
await page.keyboard.press('Escape')

// Custom status name keeps its meaning
await page.getByRole('button', { name: 'Nastavení' }).click()
const doneInput = page.getByRole('dialog').locator('input[value="Done"]')
await doneInput.fill('Hotovo')
await doneInput.press('Enter')
await page.keyboard.press('Escape')
await page.waitForTimeout(200)
const healthAfter = await page.locator('tr[data-task-no="1"] td').last().locator('..').innerText()
check('renamed status is used by the tasks', healthAfter.includes('Hotovo'))
check('Health does not change with the status name', healthBefore.includes('Green') && healthAfter.includes('Green'), JSON.stringify([healthBefore.slice(-80), healthAfter.slice(-80)]))
await tab('Kanban')
await page.waitForSelector('section[data-status="Hotovo"] [data-task-no]', { timeout: 5000 }).catch(() => {})
check('board column follows the renamed status', (await page.locator('section[data-status="Hotovo"] [data-task-no]').count()) > 5, String(await page.locator('section[data-status]').evaluateAll((s) => s.map((x) => x.dataset.status + ':' + x.querySelectorAll('[data-task-no]').length))))

// Audit trail
await tab('Historie')
const audit = await page.locator('tbody').innerText()
check('history records who changed what', audit.includes('Jana Testová') && audit.includes('CR-002') && audit.includes('Hotovo'))
check('history has no missing-name warning once the name is set', (await page.getByRole('note').count()) === 0)
if (shots) await page.screenshot({ path: `${shots}/audit.png` })

check('only the HTML file was loaded', requests.length === 1, requests.join(', '))
check('no console errors or CSP violations', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
