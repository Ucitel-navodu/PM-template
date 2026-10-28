// E2E: status report (print/PDF), PowerPoint export and portfolio deck of the
// portable build via file:// (Europe/Prague).
// Usage: node tests/e2e/reporting.mjs [path-to-index.html] [output-dir]
import { chromium } from 'playwright'
import { resolve, join } from 'node:path'
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

const url = `file://${resolve(process.argv[2] ?? 'dist-portable/index.html')}`
const out = process.argv[3] ?? mkdtempSync(join(tmpdir(), 'pm-report-'))
mkdirSync(out, { recursive: true })

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const ctx = await browser.newContext({ timezoneId: 'Europe/Prague', locale: 'cs-CZ', viewport: { width: 1600, height: 950 }, acceptDownloads: true })
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

/** List of entries in a .pptx (zip) and the text of one of them, via Python's zipfile. */
const unzip = (file, entry) =>
  JSON.parse(
    execFileSync('python3', ['-I', '-c', 'import sys,json,zipfile;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps([z.namelist(), z.read(sys.argv[2]).decode() if sys.argv[2] in z.namelist() else ""]))', file, entry], {
      encoding: 'utf8',
    }),
  )

await page.goto(`${url}#/report`)
await page.waitForSelector('[data-testid=report]')

check('report shows the project and a roadmap', (await page.locator('[data-testid=report] h2').innerText()) === 'TMS program' && (await page.locator('[data-testid=roadmap] rect').count()) > 5)
check('commentary is prefilled from the data', (await page.getByLabel('Plán na další období').inputValue()).includes('•'))

await page.getByLabel('Shrnutí', { exact: true }).fill('Tendr se blíží rozhodnutí, harmonogram drží.')
await page.getByRole('button', { name: /Uložit do historie/ }).click()
check('report is saved to the history', (await page.locator('[data-testid=report-history] li').count()) === 1)

// PowerPoint
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Stáhnout PPTX/ }).click()])
const pptx = join(out, download.suggestedFilename())
await download.saveAs(pptx)
const [entries, slide2] = unzip(pptx, 'ppt/slides/slide2.xml')
const slides = entries.filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e))
check('PPTX has 8 slides', slides.length === 8, `${slides.length} slides, ${download.suggestedFilename()}`)
check('PPTX contains the commentary', [...slide2.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join('').includes('Tendr se blíží rozhodnutí'))
check('PPTX budget slide has a native chart', entries.some((e) => /^ppt\/charts\/chart\d+\.xml$/.test(e)))

// Print -> PDF
await page.emulateMedia({ media: 'print' })
check('print hides the app chrome', !(await page.locator('nav').isVisible()) && (await page.locator('[data-testid=report]').isVisible()))
check('print shows the commentary as text', await page.locator('[data-testid=report] div', { hasText: /^Tendr se blíží rozhodnutí, harmonogram drží\.$/ }).isVisible())
const pdf = join(out, 'status-report.pdf')
await page.pdf({ path: pdf, landscape: true, format: 'A4', printBackground: true })
check('PDF is produced', readFileSync(pdf).subarray(0, 4).toString() === '%PDF')
await page.emulateMedia({ media: 'screen' })

// Portfolio deck
await page.locator('nav button', { hasText: 'Portfolio' }).click()
const [pf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /PPTX pro vedení/ }).click()])
const pfFile = join(out, pf.suggestedFilename())
await pf.saveAs(pfFile)
const [pfEntries, pfSlide] = unzip(pfFile, 'ppt/slides/slide2.xml')
// text is split into runs: compare the concatenated <a:t> contents
const pfText = [...pfSlide.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join('')
check('portfolio deck lists the project', pfEntries.length > 0 && pfText.includes('TMS program'))

check('only the HTML file was loaded', requests.filter((r) => !r.startsWith('blob:')).length === 1, requests.join(', '))
check('no console errors or CSP violations', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(`\noutput: ${out}`)
console.log(failed ? `${failed} check(s) failed` : 'all checks passed')
process.exit(failed ? 1 : 0)
