import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import noComments from './eslint-rules/no-comments.js'

const SOURCE = ['**/*.{ts,tsx,js,mjs,cjs,cts}']

const layer = (message, ...group) => ({
  'no-restricted-imports': ['error', { patterns: [{ group, message }] }],
})

export default tseslint.config(
  { ignores: ['out/', 'dist/', 'node_modules/', '.omc/', '.claude/'] },
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: SOURCE,
    plugins: { local: { rules: { 'no-comments': noComments } } },
    rules: {
      'local/no-comments': 'error',
      curly: 'error',
      eqeqeq: 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-eval': 'error',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-throw-literal': 'error',
    },
  },
  {
    files: ['src/main/**', 'src/preload/**', 'src/shared/**', '*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['eslint-rules/**/*.test.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['.omo/designs/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/renderer/**'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
    rules: layer(
      'The renderer cannot import main, preload, Electron or Node.',
      'electron',
      'node:*',
      '**/main/**',
      '**/preload/**'
    ),
  },
  {
    files: ['src/main/**'],
    rules: layer('Main cannot import the renderer.', '**/renderer/**'),
  },
  {
    files: ['src/shared/**'],
    rules: layer(
      'Shared code cannot import a process layer.',
      '**/main/**',
      '**/renderer/**',
      '**/preload/**'
    ),
  }
)
