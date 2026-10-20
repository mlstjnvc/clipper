import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// Mirrors dlmnt-fe's @dlmnt/eslint-config/vue; rules oxlint already covers are turned off.
export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/.output/**', '**/.wxt/**', '**/coverage/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  ...pluginOxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),

  skipFormatting,
)
