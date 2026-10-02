import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build` produces the normal multi-file build (for real hosting,
// e.g. behind a web server or embedded via iframe).
// `npm run build:portable` produces ONE self-contained index.html with all
// JS/CSS inlined, so it can be opened directly via file:// on any PC with
// a browser - no server, no install, no admin rights needed.
const portable = process.env.BUILD_TARGET === 'portable'

export default defineConfig({
  base: portable ? './' : '/',
  plugins: [react(), ...(portable ? [viteSingleFile()] : [])],
})
