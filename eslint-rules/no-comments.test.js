import { RuleTester } from 'eslint'
import { afterAll, describe, it } from 'vitest'
import rule from './no-comments.js'

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

ruleTester.run('no-comments', rule, {
  valid: [
    { code: '#!/usr/bin/env node\nconst a = 1\n' },
    { code: 'const slash = "a // b"\nconst block = "a /* b */ c"\n' },
    { code: 'const jsx = <div data-x="1" />\n' },
  ],
  invalid: [
    { code: 'const a = 1 // trailing\n', errors: [{ messageId: 'comment' }] },
    { code: '// leading\nconst a = 1\n', errors: [{ messageId: 'comment' }] },
    { code: 'const a = 1 /* block */\n', errors: [{ messageId: 'comment' }] },
    {
      code: '/**\n * jsdoc\n */\nfunction a() {}\n',
      errors: [{ messageId: 'comment' }],
    },
    {
      code: '/* Copyright 2026 ody */\nconst a = 1\n',
      errors: [{ messageId: 'comment' }],
    },
    {
      code: 'const jsx = <div>{/* jsx comment */}</div>\n',
      errors: [{ messageId: 'comment' }],
    },
    {
      code: '/* eslint-disable no-undef */\nconst a = b\n',
      errors: [{ messageId: 'comment' }],
    },
    {
      code: 'const a = 1\n// second line\n/* third */\n',
      errors: [{ messageId: 'comment' }, { messageId: 'comment' }],
    },
    {
      code: 'const a = 1\n// a hashbang only counts on line 1\n',
      errors: [{ messageId: 'comment' }],
    },
  ],
})
