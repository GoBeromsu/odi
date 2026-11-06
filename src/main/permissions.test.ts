import fs from 'node:fs'
import path from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import {
  coerceSettings,
  DEFAULT_SETTINGS,
  type Settings,
} from '../shared/settings.ts'

const fixture = (name: string) =>
  path.resolve(import.meta.dirname, '../../scripts', name)

const io = () => {
  let settings: Settings = { ...DEFAULT_SETTINGS }
  return {
    settings: () => settings,
    patch: (changes: Partial<Settings>) => {
      settings = coerceSettings({ ...settings, ...changes })
    },
    current: () => settings,
  }
}

const load = async (binary: string, browsers: string) => {
  vi.resetModules()
  process.env.ODY_OSASCRIPT = binary
  process.env.ODY_BROWSERS = browsers
  return await import('./permissions.ts')
}

afterEach(() => {
  delete process.env.ODY_OSASCRIPT
  delete process.env.ODY_BROWSERS
  delete process.env.ODY_OSASCRIPT_LOG
  vi.resetModules()
})

test('the browser seam lists only known bundle ids', async () => {
  const { installedBrowsers } = await load(
    fixture('fake-osascript-ok.sh'),
    'com.apple.Safari, com.google.Chrome, com.example.nope'
  )
  expect((await installedBrowsers()).map(b => b.id)).toEqual([
    'com.apple.Safari',
    'com.google.Chrome',
  ])
})

test('a successful read grants browser auth and records consent', async () => {
  const { requestBrowserAuth } = await load(
    fixture('fake-osascript-ok.sh'),
    'com.apple.Safari'
  )
  const store = io()
  expect(await requestBrowserAuth(store)).toBe('granted')
  expect(store.current().browserConsent).toBe(true)
  expect(store.current().browserAuth).toBe('granted')
})

test('a -1743 read denies browser auth but keeps consent', async () => {
  const { requestBrowserAuth } = await load(
    fixture('fake-osascript-denied.sh'),
    'com.apple.Safari'
  )
  const store = io()
  expect(await requestBrowserAuth(store)).toBe('denied')
  expect(store.current().browserConsent).toBe(true)
  expect(store.current().browserAuth).toBe('denied')
})

test('one osascript runs per seeded browser and no more', async () => {
  const log = path.join(
    process.env.TMPDIR ?? '/tmp',
    `ody-request-${process.pid}.log`
  )
  const lines = () => fs.readFileSync(log, 'utf8').trim().split('\n').length

  fs.rmSync(log, { force: true })
  process.env.ODY_OSASCRIPT_LOG = log
  const single = await load(
    fixture('fake-osascript-count.sh'),
    'com.apple.Safari'
  )
  expect(await single.requestBrowserAuth(io())).toBe('granted')
  expect(lines()).toBe(1)

  fs.rmSync(log, { force: true })
  process.env.ODY_OSASCRIPT_LOG = log
  const pair = await load(
    fixture('fake-osascript-count.sh'),
    'com.apple.Safari,com.google.Chrome'
  )
  expect(await pair.requestBrowserAuth(io())).toBe('granted')
  expect(lines()).toBe(2)
  fs.rmSync(log, { force: true })
})

test('no installed browser leaves nothing to deny', async () => {
  const { requestBrowserAuth } = await load(
    fixture('fake-osascript-denied.sh'),
    'com.example.nope'
  )
  const store = io()
  expect(await requestBrowserAuth(store)).toBe('granted')
  expect(store.current().browserConsent).toBe(true)
})
