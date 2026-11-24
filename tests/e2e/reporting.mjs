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

/** Colours and fonts used anywhere in a .pptx (slides, masters, layouts, charts) + slides without a picture. */
const brandAudit = (file) =>
  JSON.parse(
    execFileSync(
      'python3',
      [
        '-I',
        '-c',
        `import sys,json,re,zipfile
z=zipfile.ZipFile(sys.argv[1])
parts=[n for n in z.namelist() if re.match(r'ppt/(slides|slideMasters|slideLayouts|charts)/[^/]+\\.xml$',n)]
theme=z.read('ppt/theme/theme1.xml').decode()
themeFonts=dict(re.findall(r'<a:(major|minor)Font><a:latin typeface="([^"]+)"',theme))
cols=set();fonts=set();nopic=[]
for n in parts:
  x=z.read(n).decode()
  cols|=set(re.findall(r'srgbClr val="([0-9A-Fa-f]{6})"',x))
  for f in re.findall(r'<a:latin typeface="([^"]+)"',x):
    fonts.add(themeFonts.get('major' if f=='+mj-lt' else 'minor') if f.startswith('+m') else f)
for n in [n for n in z.namelist() if re.match(r'ppt/slides/slide\\d+\\.xml$',n)]:
  rel=z.read(n.replace('slides/','slides/_rels/')+'.rels').decode()
  layout='ppt/slideLayouts/'+re.search(r'slideLayouts/([^"]+)',rel).group(1)
  if '<p:pic>' not in z.read(layout).decode(): nopic.append(n)
print(json.dumps({'colors':sorted(c.upper() for c in cols),'fonts':sorted(fonts),'slidesWithoutLogo':nopic}))`,
        file,
      ],
      { encoding: 'utf8' },
    ),
  )
/**
 * Geometry of every slide (with its layout): objects outside the 13.333 x 7.5 in slide, and tables /
 * charts / pictures overlapping another object (text over its own shape - KPI tiles, map cells, labels
 * in bars - is intended and not reported).
 */
const layoutAudit = (file) =>
  JSON.parse(
    execFileSync(
      'python3',
      [
        '-I',
        '-c',
        `import sys,json,re,zipfile
z=zipfile.ZipFile(sys.argv[1])
W,H=12192000,6858000
def objs(x):
  out=[]
  for kind,body in re.findall(r'<p:(sp|pic|graphicFrame)>(.*?)</p:\\1>',x,re.S):
    m=re.search(r'<a:off x="(-?\\d+)" y="(-?\\d+)"/><a:ext cx="(\\d+)" cy="(\\d+)"/>',body)
    if not m: continue
    x0,y0,w,h=map(int,m.groups())
    name=re.search(r'name="([^"]*)"',body); txt=''.join(re.findall(r'<a:t>([^<]*)</a:t>',body))[:30]
    out.append((kind,x0,y0,w,h,(name.group(1) if name else kind)+':'+txt))
  return out
outside=[];overlaps=[]
slides=sorted([n for n in z.namelist() if re.match(r'ppt/slides/slide\\d+\\.xml$',n)],key=lambda n:int(re.findall(r'\\d+',n)[0]))
for n in slides:
  rel=z.read(n.replace('slides/','slides/_rels/')+'.rels').decode()
  layout='ppt/slideLayouts/'+re.search(r'slideLayouts/([^"]+)',rel).group(1)
  lo=[o for o in objs(z.read(layout).decode()) if o[0]=='pic']
  so=objs(z.read(n).decode())
  for o in lo+so:
    k,x0,y0,w,h,lab=o
    if x0<0 or y0<0 or x0+w>W+1 or y0+h>H+1: outside.append(n.split('/')[-1]+' '+lab)
  allo=lo+so
  for i,a in enumerate(allo):
    for b in allo[i+1:]:
      if not (a[0] in ('graphicFrame','pic') or b[0] in ('graphicFrame','pic')): continue
      if a[0]=='sp' and b[0]=='sp': continue
      ix=min(a[1]+a[3],b[1]+b[3])-max(a[1],b[1]); iy=min(a[2]+a[4],b[2]+b[4])-max(a[2],b[2])
      if ix>9144 and iy>9144: overlaps.append(n.split('/')[-1]+' '+a[5]+' x '+b[5])
print(json.dumps({'outside':outside,'overlaps':overlaps}))`,
        file,
      ],
      { encoding: 'utf8' },
    ),
  )

// Manual 4.1 / 4.2 (+ white, black text fallback and light tints of grey 429 C for lines and stripes)
const BRAND_COLORS = new Set(['D81E04', '676D6F', 'AEAFAB', 'FBBA00', 'E84E0F', '791307', 'F8F6F6', '00B1EB', '00779C', '00404A', '90A3B2', 'C8D300', '689425', '163D14', '2B3035', 'FFFFFF', '000000', 'E2E2E0', 'CBCCC9', 'EFEEED', 'FBDED9', 'FFEFB8', 'E0EBCD'])
const slideTexts = (file) => {
  const [entries] = unzip(file, '')
  return entries
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
    .map((e) => [...unzip(file, e)[1].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(' '))
}

await page.goto(`${url}#/report`)
await page.waitForSelector('[data-testid=report]')
const register = page.getByTestId('risk-register')
check('report risk page has the P×I map', (await page.locator('[data-testid=report] [data-testid=risk-matrix] [data-cell]').count()) === 16)
check('report risk page has the full register with a header', (await register.locator('thead th').count()) === 11 && (await register.locator('tbody tr').count()) === 2, await register.locator('thead').innerText())

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
check('PPTX has 10 slides (2 risk slides + closing)', slides.length === 10, `${slides.length} slides, ${download.suggestedFilename()}`)
check('PPTX contains the commentary', [...slide2.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join('').includes('Tendr se blíží rozhodnutí'))
check('PPTX budget slide has a native chart', entries.some((e) => /^ppt\/charts\/chart\d+\.xml$/.test(e)))
const texts = slideTexts(pptx)
check('PPTX has a risk map slide (map, counts, top 5)', texts.some((t) => t.includes('Rizika a issues – mapa') && t.includes('Pravděpodobnost') && t.includes('Top 5') && t.includes('R-001')))
check('PPTX has a full-width risk register slide', texts.some((t) => t.includes('Registr rizik a issues') && t.includes('R-002') && t.includes('Opatření')))
const layout = layoutAudit(pptx)
check('PPTX: every object lies inside the slide', layout.outside.length === 0, layout.outside.slice(0, 5).join(' | '))
check('PPTX: tables, charts and pictures do not overlap other objects', layout.overlaps.length === 0, layout.overlaps.slice(0, 5).join(' | '))
const audit = brandAudit(pptx)
const offBrand = audit.colors.filter((c) => !BRAND_COLORS.has(c))
check('PPTX uses only the colours of the brand manual', offBrand.length === 0, offBrand.join(', '))
check('PPTX uses only Arial', audit.fonts.length > 0 && audit.fonts.every((f) => f === 'Arial'), audit.fonts.join(', '))
check('every slide carries the logo (via its layout)', audit.slidesWithoutLogo.length === 0, audit.slidesWithoutLogo.join(', '))

// Print -> PDF
await page.emulateMedia({ media: 'print' })
check('print hides the app chrome', !(await page.locator('nav').isVisible()) && (await page.locator('[data-testid=report]').isVisible()))
check('print shows the commentary as text', await page.locator('[data-testid=report] div', { hasText: /^Tendr se blíží rozhodnutí, harmonogram drží\.$/ }).isVisible())
const pdf = join(out, 'status-report.pdf')
await page.pdf({ path: pdf, landscape: true, format: 'A4', printBackground: true })
check('PDF is produced', readFileSync(pdf).subarray(0, 4).toString() === '%PDF')
await page.emulateMedia({ media: 'screen' })

// Many risks: the register continues on more slides
await page.locator('nav button', { hasText: 'RAID' }).click()
await page.getByRole('tab', { name: /Rizika/ }).click()
for (let i = 0; i < 18; i++) await page.getByRole('button', { name: /\+ Přidat/ }).click()
await page.locator('nav button', { hasText: 'Report' }).click()
await page.waitForSelector('[data-testid=report]')
const regRows = await register.locator('tbody tr').count()
const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Stáhnout PPTX/ }).click()])
const pptx2 = join(out, 'many-risks.pptx')
await dl2.saveAs(pptx2)
const texts2 = slideTexts(pptx2)
const riskSlides = texts2.filter((t) => t.includes('Registr rizik a issues'))
check('the report lists every open risk', regRows === 20, String(regRows))
check('20 risks: map slide + 2 register slides (12 + 8 rows)', riskSlides.length === 2 && riskSlides[1].includes('(2/2)') && texts2.length === 11, `${riskSlides.length} register slides, ${texts2.length} slides`)
const layout2 = layoutAudit(pptx2)
check('PPTX with 20 risks: nothing outside the slide or overlapping', layout2.outside.length + layout2.overlaps.length === 0, [...layout2.outside, ...layout2.overlaps].slice(0, 5).join(' | '))

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
