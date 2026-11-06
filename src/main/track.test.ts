import path from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'

const fixture = (name: string) =>
  path.resolve(import.meta.dirname, '../../scripts', name)

const DENIAL =
  'execution error: Not authorized to send Apple events to Safari. (-1743)'

const load = async (binary: string) => {
  vi.resetModules()
  process.env.ODY_OSASCRIPT = binary
  return await import('./track.ts')
}

afterEach(() => {
  delete process.env.ODY_OSASCRIPT
  vi.resetModules()
})

test('the denial parser recognises the Apple events error number', async () => {
  const track = await load(fixture('fake-osascript-ok.sh'))
  expect(track.isAutomationDenied(DENIAL)).toBe(true)
  expect(track.isAutomationDenied('execution error: nope (-600)')).toBe(false)
  expect(track.isAutomationDenied('')).toBe(false)
})

test('supported browsers resolve by front bundle id and by plain id', async () => {
  const track = await load(fixture('fake-osascript-ok.sh'))
  expect(track.browserFor('com.apple.Safari')?.name).toBe('Safari')
  expect(track.browserFor('COM.GOOGLE.CHROME')?.id).toBe('com.google.Chrome')
  expect(track.browserFor('md.obsidian')).toBeNull()
  expect(track.browserFor(null)).toBeNull()
  expect(track.browserById('com.apple.safari')?.id).toBe('com.apple.Safari')
  expect(track.browserById('md.obsidian')).toBeNull()
})

test('host keeps bare https hosts and drops anything else', async () => {
  const track = await load(fixture('fake-osascript-ok.sh'))
  expect(track.host('https://www.example.com/a/b?c=1')).toBe('example.com')
  expect(track.host('file:///tmp/x')).toBeNull()
  expect(track.host('not a url')).toBeNull()
})

test('readDomain returns the host when osascript succeeds', async () => {
  const track = await load(fixture('fake-osascript-ok.sh'))
  expect(track.osascriptBinary()).toBe(fixture('fake-osascript-ok.sh'))
  const read = await track.readDomain(track.browserById('com.apple.Safari')!)
  expect(read).toEqual({ domain: 'example.com', denied: false, failed: false })
})

test('readDomain reports denied when osascript prints -1743', async () => {
  const track = await load(fixture('fake-osascript-denied.sh'))
  const read = await track.readDomain(track.browserById('com.apple.Safari')!)
  expect(read).toEqual({ domain: null, denied: true, failed: true })
})

test('the count fixture logs one line per spawn', async () => {
  const log = path.join(
    process.env.TMPDIR ?? '/tmp',
    `ody-osascript-${process.pid}.log`
  )
  process.env.ODY_OSASCRIPT_LOG = log
  const fs = await import('node:fs')
  fs.rmSync(log, { force: true })
  const track = await load(fixture('fake-osascript-count.sh'))
  const safari = track.browserById('com.apple.Safari')!
  await track.readDomain(safari)
  await track.readDomain(safari)
  const lines = fs.readFileSync(log, 'utf8').trim().split('\n')
  expect(lines).toHaveLength(2)
  fs.rmSync(log, { force: true })
  delete process.env.ODY_OSASCRIPT_LOG
})
