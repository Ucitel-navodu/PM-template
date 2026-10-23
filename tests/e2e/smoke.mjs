// E2E smoke test of the portable build opened via file:// (as users run it).
// Usage: node tests/e2e/smoke.mjs [path-to-index.html] [screenshot-dir]
import { chromium } from 'playwright'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

const file = resolve(process.argv[2] ?? 'dist-portable/index.html')
const shots = process.argv[3]
if (shots) mkdirSync(shots, { recursive: true })
const url = `file://${file}`

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const ctx = await browser.newContext({ timezoneId: 'Europe/Prague', locale: 'cs-CZ', viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const errors = []
const requests = []
const cspViolations = []
page.on('console', (m) => m.type() === 'error' && !m.text().includes('Content Security Policy') && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
page.on('request', (r) => requests.push(r.url()))
page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Druhý projekt' : undefined))

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
  if (!ok) failed++
}

await page.goto(url)
await page.waitForSelector('nav button')
await page.waitForTimeout(500)

check('only the HTML file itself is loaded', requests.every((r) => r.startsWith('file://')) && requests.length === 1, requests.join(', '))

const fetchBlocked = await page.evaluate(async () => {
  try {
    await fetch('https://example.com/')
    return false
  } catch {
    return true
  }
})
page.on('console', (m) => m.text().includes('Content Security Policy') && cspViolations.push(m.text()))
check('CSP blocks network access (fetch)', fetchBlocked)

check('sample project loaded', (await page.locator('select[aria-label]').inputValue()).length > 0)
check('sync status shown', await page.getByTestId('sync-status').isVisible())

// Portfolio
await page.locator('nav button', { hasText: /Portfolio/ }).click()
check('portfolio lists the project', (await page.locator('tbody tr').count()) === 1)
if (shots) await page.screenshot({ path: `${shots}/portfolio-light.png`, fullPage: true })
await page.getByRole('button', { name: /Nový projekt/ }).click()
await page.waitForTimeout(200)
check('new project created and active', (await page.locator('select[aria-label] option').count()) === 2)

// Undo / redo of the project creation
await page.locator('nav button', { hasText: /Portfolio/ }).click()
await page.keyboard.press('Control+z')
await page.waitForTimeout(100)
check('Ctrl+Z undoes the project creation', (await page.locator('tbody tr').count()) === 1)
await page.keyboard.press('Control+y')
await page.waitForTimeout(100)
check('Ctrl+Y redoes it', (await page.locator('tbody tr').count()) === 2)

// Switch back to the sample and walk all tabs
await page.locator('select[aria-label]').selectOption({ index: 0 })
for (const tab of await page.locator('nav button').allInnerTexts()) {
  await page.locator('nav button', { hasText: tab }).first().click()
  await page.waitForTimeout(150)
}
check('all tabs render without console errors', errors.length === 0, errors.join(' | '))

// Persistence across reload (IndexedDB cache)
await page.waitForTimeout(1500)
await page.reload()
await page.waitForSelector('nav button')
check('workspace survives reload', (await page.locator('select[aria-label] option').count()) === 2)

// Dark mode + EN
await page.locator('nav button').nth(1).click()
await page.getByRole('button', { name: /tmavý|dark/i }).click()
await page.getByRole('button', { name: 'EN', exact: true }).click()
await page.waitForTimeout(200)
check('dark mode applied', await page.evaluate(() => document.documentElement.classList.contains('dark')))
if (shots) await page.screenshot({ path: `${shots}/dashboard-dark-en.png`, fullPage: true })

// About dialog lists the bundled licenses
await page.getByRole('button', { name: /Help|Nápověda/ }).first().click()
await page.getByRole('button', { name: /About|O aplikaci/ }).click()
check('About dialog lists licenses', (await page.locator('[aria-label="About"] details').count()) > 5)
if (shots) await page.screenshot({ path: `${shots}/about-dark-en.png` })
await page.keyboard.press('Escape')

check('no uncaught errors overall', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
