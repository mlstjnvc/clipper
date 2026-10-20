import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

// Tests must not depend on a developer's .env files; WXT needs some API URL to resolve the manifest.
process.env.WXT_API_URL ??= 'https://api.test/v3'

export default defineConfig({
  // WxtVitest gives tests the build's aliases, auto-imports and `fakeBrowser` polyfill, but not
  // the plugins WXT modules add, so Vue's is registered here.
  plugins: [vue(), WxtVitest()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      // Entry points only wire things together; what they call is covered.
      exclude: ['src/entrypoints/background.ts', 'src/entrypoints/extract.ts', 'src/**/main.ts'],
      // The extraction, API and storage code is where bugs would hurt; keep it well covered.
      thresholds: {
        'src/lib/**': { lines: 90 },
      },
    },
  },
})
