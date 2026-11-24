// E2E: ORLEN Unipetrol look (Settings > Appearance) in the portable build via file:// (Europe/Prague).
// Usage: node tests/e2e/appearance.mjs [path-to-index.html] [screenshot-dir]
import { chromium } from 'playwright'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

const url = `file://${resolve(process.argv[2] ?? 'dist-portable/index.html')}`
const shots = process.argv[3]
if (shots) mkdirSync(shots, { recursive: true })

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const ctx = await browser.newContext({ timezoneId: 'Europe/Prague', locale: 'cs-CZ', viewport: { width: 1500, height: 950 } })
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
const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const theme = () => page.evaluate(() => document.documentElement.dataset.theme)
const headerLogo = () => page.locator('header [data-testid=brand-logo]:visible')
const openSettings = async () => {
  await page.getByRole('button', { name: 'Nastavení' }).click()
  await page.getByRole('radiogroup').waitFor()
}
const contrastOf = (selector) =>
  page.evaluate((sel) => {
    const lum = ([r, g, b]) => [r, g, b].map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0)
    const el = document.querySelector(sel)
    const cs = getComputedStyle(el)
    const [a, b] = [lum(cs.color.match(/\d+/g).map(Number)), lum(cs.backgroundColor.match(/\d+/g).map(Number))].sort((x, y) => y - x)
    return (a + 0.05) / (b + 0.05)
  }, selector)

await page.goto(`${url}#/dashboard`)
await page.waitForSelector('nav button')

// light corporate look by default
check('first start uses the light ORLEN look', (await theme()) === 'orlen-light' && (await bodyBg()) === 'rgb(248, 246, 246)', `${await theme()} ${await bodyBg()}`)
const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
check('font is Arial (manual: internal materials)', font.startsWith('Arial'), font)
check('header shows the colour trade mark', (await headerLogo().count()) === 1 && (await headerLogo().getAttribute('data-variant')) === 'color')
const box = await headerLogo().locator('svg').boundingBox()
check('logo is at least 50 px wide (manual: digital minimum)', box.width >= 50, `${box.width.toFixed(0)} px`)
const zone = await headerLogo().evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft))
check('logo keeps its exclusion zone (height of the O)', zone >= box.height * 0.2, `${zone}px for a ${box.height}px mark`)
const fills = await headerLogo().locator('path').evaluateAll((ps) => [...new Set(ps.map((p) => p.getAttribute('fill')))].sort().join())
check('logo uses only the brand red and grey', fills === '#676d6f,#d81e04', fills)
check('active tab is the brand red with readable text', (await contrastOf('nav button[aria-current=page]')) >= 4.5)
if (shots) await page.screenshot({ path: `${shots}/orlen-light.png` })

await openSettings()
check('picker offers exactly the two ORLEN looks', (await page.locator('[data-palette]').count()) === 2)
check('the tiles preview the logo', (await page.locator('[data-palette] [data-testid=brand-logo]').count()) === 2)
await page.locator('[data-palette="orlen-dark"]').click()
await page.waitForTimeout(250) // body background has a short transition
check('dark ORLEN look', (await theme()) === 'orlen-dark' && (await bodyBg()) === 'rgb(43, 48, 53)', `${await theme()} ${await bodyBg()}`)
check('primary button: white on the brand red', (await page.getByRole('button', { name: 'Zavřít', exact: true }).last().evaluate((b) => getComputedStyle(b).backgroundColor)) === 'rgb(216, 30, 4)')
await page.keyboard.press('Escape')
check('dark header shows the white negative logo (manual 2.5)', (await headerLogo().getAttribute('data-variant')) === 'negative')
if (shots) await page.screenshot({ path: `${shots}/orlen-dark.png` })

// persistence + no flash: the palette is set before the app mounts
await page.reload()
await page.waitForSelector('nav button')
check('look survives a reload', (await theme()) === 'orlen-dark')
const early = async (init) => {
  const p2 = await ctx.newPage()
  await p2.addInitScript((v) => {
    if (v) localStorage.setItem('pm-web:palette', JSON.stringify(v))
    document.addEventListener('DOMContentLoaded', () => (window.__early = document.documentElement.dataset.theme))
  }, init)
  await p2.goto(`${url}#/dashboard`)
  const v = await p2.evaluate(() => window.__early)
  await p2.close()
  return v
}
check('look is applied before the app code runs (no flash)', (await early()) === 'orlen-dark')
check('a saved Jarvis palette becomes the dark ORLEN look', (await early('nebula')) === 'orlen-dark')
check('a saved light palette becomes the light ORLEN look', (await early('light')) === 'orlen-light')
await page.evaluate(() => localStorage.setItem('pm-web:palette', JSON.stringify('orlen-dark')))

// sun/moon toggles light <-> dark
await page.getByRole('button', { name: /^Světlý$/ }).click()
await page.waitForTimeout(300)
check('toggle -> light look', (await theme()) === 'orlen-light' && (await bodyBg()) === 'rgb(248, 246, 246)', await bodyBg())
await page.getByRole('button', { name: /^Tmavý$/ }).click()
check('toggle -> dark look', (await theme()) === 'orlen-dark')

// opened drop-down lists stay readable on the dark look (text vs. list background)
await page.locator('nav button', { hasText: 'Úkoly' }).first().click()
await page.waitForSelector('tbody tr select')
check('drop-down options are readable in dark mode (contrast >= 7)', (await contrastOf('tbody tr select option')) >= 7)

// report: logo + graphic symbol cut by the edge
await page.locator('nav button', { hasText: 'Report' }).first().click()
await page.waitForSelector('[data-testid=report]')
const sym = await page.locator('[data-testid=report] header [data-brand-symbol]').boundingBox()
const head = await page.locator('[data-testid=report] header').boundingBox()
check('report header has the logo', (await page.locator('[data-testid=report] header [data-testid=brand-logo]:visible').count()) === 1)
check('graphic symbol is cut by the edge (manual 5.4)', sym.x + sym.width > head.x + head.width && sym.y < head.y, JSON.stringify({ sym, head }))

// every page renders in the dark look (visual smoke + no errors)
for (const tab of ['Úkoly', 'Gantt', 'Kanban', 'RAID', 'Report', 'Portfolio']) {
  await page.locator('nav button', { hasText: tab }).first().click()
  await page.waitForTimeout(250)
  if (shots) await page.screenshot({ path: `${shots}/dark-${tab}.png` })
}

check('only the HTML file was loaded (reloads included)', new Set(requests.filter((r) => !r.startsWith('data:'))).size === 1, [...new Set(requests)].join(', '))
check('no console errors or CSP violations', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
