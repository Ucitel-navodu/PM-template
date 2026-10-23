// E2E: autosave into a working file + detection of a colleague's save.
// The native file pickers are replaced by handles into the Origin Private
// File System, which supports the same FileSystemFileHandle API.
// Usage: node tests/e2e/file-sync.mjs [dist-dir]
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const html = readFileSync(resolve(process.argv[2] ?? 'dist-portable', 'index.html'))
const server = createServer((_, res) => res.writeHead(200, { 'content-type': 'text/html' }).end(html)).listen(0)
const url = `http://localhost:${server.address().port}/`

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const ctx = await browser.newContext({ timezoneId: 'Europe/Prague' })
await ctx.addInitScript(() => {
  const handle = async () => (await navigator.storage.getDirectory()).getFileHandle('ws.pmw.json', { create: true })
  window.showSaveFilePicker = handle
  window.showOpenFilePicker = async () => [await handle()]
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Nový' : undefined))

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
  if (!ok) failed++
}
const readFile = () =>
  page.evaluate(async () => {
    const h = await (await navigator.storage.getDirectory()).getFileHandle('ws.pmw.json')
    return JSON.parse(await (await h.getFile()).text())
  })
const status = () => page.getByTestId('sync-status').getAttribute('data-status')

await page.goto(url)
await page.waitForSelector('nav button')
await page.getByRole('button', { name: 'Uložit do souboru…' }).first().click()
await page.waitForFunction(() => document.querySelector('[data-testid=sync-status]')?.getAttribute('data-status') === 'saved')
const first = await readFile()
check('workspace written to the linked file', first.fileType === 'pm-web-workspace' && first.revision === 1)

// Edit -> autosave (default 2 s debounce)
await page.goto(`${url}#/portfolio`)
await page.getByRole('button', { name: /Nový projekt/ }).click()
await page.waitForTimeout(3000)
const second = await readFile()
check('edit is autosaved into the file', second.projects.length === 2 && second.revision === 2, `rev ${second.revision}`)
check('status is saved', (await status()) === 'saved', await status())

// A colleague saves the same file (newer revision) ...
await page.evaluate(async () => {
  const h = await (await navigator.storage.getDirectory()).getFileHandle('ws.pmw.json')
  const ws = JSON.parse(await (await h.getFile()).text())
  ws.revision += 1
  ws.projects[0].info.projectName = 'Changed by a colleague'
  const w = await h.createWritable()
  await w.write(JSON.stringify(ws))
  await w.close()
})
// ... and we edit too
await page.locator('nav button', { hasText: 'Portfolio' }).click()
await page.getByRole('button', { name: /Nový projekt/ }).click()
await page.waitForTimeout(3000)
check('conflict detected instead of overwriting', (await status()) === 'conflict', await status())
check('colleague version kept in the file', (await readFile()).projects[0].info.projectName === 'Changed by a colleague')

await page.getByRole('button', { name: 'Načíst verzi ze souboru' }).click()
await page.waitForTimeout(500)
check('taking the file version resolves the conflict', (await status()) === 'saved', await status())
check('file version is now shown', (await page.locator('select[aria-label] option').first().innerText()) === 'Changed by a colleague')

// The handle is remembered across reloads
await page.reload()
await page.waitForSelector('nav button')
await page.waitForTimeout(500)
const afterReload = await status()
check('file link survives reload', ['saved', 'needs-permission'].includes(afterReload), afterReload)

check('no uncaught errors', errors.length === 0, errors.join(' | '))
await browser.close()
server.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
