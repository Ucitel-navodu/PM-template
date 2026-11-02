// E2E: colour palettes (Settings > Appearance) in the portable build via file:// (Europe/Prague).
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
const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`
const openSettings = async () => {
  await page.getByRole('button', { name: 'Nastavení' }).click()
  await page.getByRole('radiogroup').waitFor()
}

const PALETTES = { nexus: '#0a0f1c', nebula: '#100c1f', emerald: '#071612', sapphire: '#091321', titanium: '#101318' }

await page.goto(`${url}#/dashboard`)
await page.waitForSelector('nav button')
check('first start uses Nexus Cyan', (await theme()) === 'nexus' && (await bodyBg()) === rgb(PALETTES.nexus), await bodyBg())

await openSettings()
check('picker offers 6 looks', (await page.locator('[data-palette]').count()) === 6)
for (const [id, bg] of Object.entries(PALETTES)) {
  await page.locator(`[data-palette="${id}"]`).click()
  await page.waitForTimeout(250) // body background has a short transition
  check(`${id}: page colour matches Jarvis`, (await theme()) === id && (await bodyBg()) === rgb(bg), `${await theme()} ${await bodyBg()}`)
  if (shots) await page.screenshot({ path: `${shots}/palette-${id}.png` })
}

// a primary button keeps readable text (white on the darkened accent)
const btnContrast = await page.evaluate(() => {
  const lum = ([r, g, b]) => [r, g, b].map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0)
  const btn = [...document.querySelectorAll('button')].find((b) => /Zavřít/.test(b.textContent))
  const m = getComputedStyle(btn).backgroundColor.match(/\d+/g).map(Number)
  const l = lum(m)
  return (1.05) / (l + 0.05)
})
check('primary button contrast >= 4.5', btnContrast >= 4.5, btnContrast.toFixed(2))

// custom accent
await page.getByTestId('accent-input').fill('#ff8800')
await page.waitForTimeout(150)
const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pm-primary').trim())
check('custom accent overrides the palette accent', accent === '255 136 0', accent)
if (shots) await page.screenshot({ path: `${shots}/palette-custom-accent.png` })
await page.getByRole('button', { name: /Vrátit barvu palety/ }).click()
check('accent can be reset', (await page.evaluate(() => document.documentElement.style.getPropertyValue('--pm-primary'))) === '')

// persistence + no flash: the palette is set before the app mounts
await page.locator('[data-palette="emerald"]').click()
await page.reload()
await page.waitForSelector('nav button')
check('palette survives a reload', (await theme()) === 'emerald')
const early = await (async () => {
  const p2 = await ctx.newPage()
  await p2.addInitScript(() => document.addEventListener('DOMContentLoaded', () => (window.__early = document.documentElement.dataset.theme)))
  await p2.goto(`${url}#/dashboard`)
  const v = await p2.evaluate(() => window.__early)
  await p2.close()
  return v
})()
check('palette is applied before the app code runs (no flash)', early === 'emerald', String(early))

// sun/moon toggles light <-> last dark palette
await page.getByRole('button', { name: /^Světlý$/ }).click()
await page.waitForTimeout(300)
check('toggle -> light look', (await theme()) === 'light' && (await bodyBg()) === 'rgb(244, 245, 247)', await bodyBg())
if (shots) await page.screenshot({ path: `${shots}/palette-light.png` })
await page.getByRole('button', { name: /^Tmavý$/ }).click()
check('toggle returns to the last dark palette', (await theme()) === 'emerald')

// every page renders in a non-default palette (visual smoke + no errors)
for (const tab of ['Úkoly', 'Gantt', 'Kanban', 'RAID', 'Report', 'Portfolio']) {
  await page.locator('nav button', { hasText: tab }).first().click()
  await page.waitForTimeout(250)
  if (shots) await page.screenshot({ path: `${shots}/emerald-${tab}.png` })
}

check('only the HTML file was loaded (reload included)', new Set(requests).size === 1, [...new Set(requests)].join(', '))
check('no console errors or CSP violations', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
