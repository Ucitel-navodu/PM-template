// Pre-build: verify that every runtime dependency bundled into the app has a
// permissive license, and generate the data for the in-app "About" dialog:
// src/generated/licenses.json (notices) and src/generated/sbom.json (CycloneDX).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ALLOWED = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD'])
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const run = (args) => execFileSync(npm, args, { encoding: 'utf8', shell: process.platform === 'win32' })

const dirs = run(['ls', '--omit=dev', '--all', '--parseable'])
  .split(/\r?\n/)
  .slice(1) // the app itself
  .filter(Boolean)

const seen = new Map()
for (const dir of dirs) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  if (pkg.name.startsWith('@types/')) continue // type declarations only, nothing is bundled
  const key = `${pkg.name}@${pkg.version}`
  if (seen.has(key)) continue
  const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? 'UNKNOWN'
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)/i.test(f))
  seen.set(key, {
    name: pkg.name,
    version: pkg.version,
    license,
    homepage: typeof pkg.homepage === 'string' ? pkg.homepage : undefined,
    text: file ? readFileSync(join(dir, file), 'utf8').trim() : '',
  })
}

const packages = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
const bad = packages.filter((p) => !p.license.split(/\s+OR\s+/).some((l) => ALLOWED.has(l.replace(/[()]/g, ''))))
if (bad.length) {
  console.error('Disallowed licenses:\n' + bad.map((p) => `  ${p.name}@${p.version}: ${p.license}`).join('\n'))
  process.exit(1)
}

const out = 'src/generated'
if (!existsSync(out)) mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'licenses.json'), JSON.stringify(packages, null, 2) + '\n')

const sbom = JSON.parse(run(['sbom', '--omit', 'dev', '--sbom-format', 'cyclonedx']))
delete sbom.serialNumber // keep the generated file stable between builds
if (sbom.metadata) delete sbom.metadata.timestamp
writeFileSync(join(out, 'sbom.json'), JSON.stringify(sbom, null, 2) + '\n')
console.log(`licenses OK: ${packages.length} runtime packages (${[...new Set(packages.map((p) => p.license))].join(', ')})`)
