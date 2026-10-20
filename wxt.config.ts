import { defineConfig } from 'wxt'
import { buildManifest } from './src/manifest'

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue'],
  // WXT defaults Firefox to MV2; every target is MV3.
  manifestVersion: 3,
  // WXT loads .env.<mode> into process.env before the manifest is built.
  manifest: ({ mode, browser }) =>
    buildManifest({ apiUrl: process.env.WXT_API_URL, mode, browser }),
})
