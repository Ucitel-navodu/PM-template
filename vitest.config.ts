import { defineConfig } from 'vitest/config'

// Run in the users' timezone: date bugs around the CET/CEST switch only show up there.
process.env.TZ = 'Europe/Prague'

export default defineConfig({
  define: { __APP_VERSION__: '"test"', __BUILD_DATE__: '"test"' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['fake-indexeddb/auto'],
  },
})
