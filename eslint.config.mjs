import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const noComments = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: { comment: 'This project has no code comments.' },
  },
  create: context => ({
    Program() {
      for (const loc of context.sourceCode.getAllComments()) {
        context.report({ loc: loc.loc, messageId: 'comment' })
      }
    },
  }),
}

const layer = (message, ...group) => ({
  'no-restricted-imports': ['error', { patterns: [{ group, message }] }],
})

export default tseslint.config(
  { ignores: ['out/', 'node_modules/', '.omc/', '.claude/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
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
    files: [
      'src/main/**',
      'src/preload/**',
      'src/shared/**',
      '*.mjs',
      'scripts/**',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/renderer/**'],
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
