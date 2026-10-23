// Post-build: inject a strict Content-Security-Policy <meta> into the built HTML.
// Inline <script>/<style> blocks (the portable single-file build inlines everything)
// are allowed by their sha256 hash; nothing may be fetched from the network.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) throw new Error('usage: node scripts/csp.mjs <index.html>')
let html = readFileSync(file, 'utf8')

const hashes = (tag) =>
  [...html.matchAll(new RegExp(`<${tag}\\b(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map(
    (m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`,
  )

const policy = [
  "default-src 'none'",
  `script-src 'self' ${hashes('script').join(' ')}`,
  `style-src 'self' ${hashes('style').join(' ')}`,
  // Inline style *attributes* only (frappe-gantt colours holiday columns with
  // setAttribute('style')). They cannot run code, and with connect-src/img-src
  // closed they cannot send data anywhere; <style> blocks stay hash-locked.
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join('; ')

if (html.includes('http-equiv="Content-Security-Policy"')) throw new Error('CSP already present')
html = html.replace(/(<meta charset[^>]*>)/i, `$1\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
writeFileSync(file, html)
console.log(`CSP injected into ${file}`)
