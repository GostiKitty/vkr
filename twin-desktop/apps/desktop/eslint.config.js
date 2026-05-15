import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Syncing local form state from props / external defaults is common in this app;
      // the rule rejects legitimate "reset when X changes" patterns.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: [
      '**/ThermalSimulationPanel.tsx',
      '**/Build3DStablePreview.tsx',
      '**/Build3DRecoveredPreview.tsx',
      '**/ModelPage.tsx',
      '**/ThemeProvider.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
