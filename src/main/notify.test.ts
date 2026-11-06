import { describe, expect, it, vi } from 'vitest'
import {
  askNotifications,
  isNotifyGranted,
  parseNotifyStatus,
  type NotifyCommand,
  type NotifyStatus,
} from './notify.ts'

describe('parseNotifyStatus', () => {
  it('reads every status the helper can print', () => {
    expect(parseNotifyStatus('authorized\n')).toBe('authorized')
    expect(parseNotifyStatus('denied\n')).toBe('denied')
    expect(parseNotifyStatus('notDetermined\n')).toBe('notDetermined')
    expect(parseNotifyStatus('provisional\n')).toBe('provisional')
  })

  it('takes the last line and ignores noise', () => {
    expect(parseNotifyStatus('warning: ignored\nauthorized\n')).toBe(
      'authorized'
    )
    expect(parseNotifyStatus('  denied  ')).toBe('denied')
  })

  it('falls back to unavailable for anything else', () => {
    expect(parseNotifyStatus('')).toBe('unavailable')
    expect(parseNotifyStatus('command not found')).toBe('unavailable')
  })
})

describe('isNotifyGranted', () => {
  it('counts authorized and provisional as granted', () => {
    expect(isNotifyGranted('authorized')).toBe(true)
    expect(isNotifyGranted('provisional')).toBe(true)
    expect(isNotifyGranted('denied')).toBe(false)
    expect(isNotifyGranted('notDetermined')).toBe(false)
    expect(isNotifyGranted('unavailable')).toBe(false)
  })
})

describe('askNotifications', () => {
  const runner = (answers: NotifyStatus[]) => {
    const calls: NotifyCommand[] = []
    const run = vi.fn(async (_binary: string, command: NotifyCommand) => {
      calls.push(command)
      return answers[calls.length - 1]
    })
    return { run, calls }
  }

  it('requests authorization only when the status is notDetermined', async () => {
    const first = runner(['notDetermined', 'authorized'])
    await expect(askNotifications('helper', first.run)).resolves.toBe(
      'authorized'
    )
    expect(first.calls).toEqual(['status', 'request'])
  })

  it('keeps a decided status without prompting again', async () => {
    const decided = runner(['denied'])
    await expect(askNotifications('helper', decided.run)).resolves.toBe(
      'denied'
    )
    expect(decided.calls).toEqual(['status'])

    const allowed = runner(['authorized'])
    await expect(askNotifications('helper', allowed.run)).resolves.toBe(
      'authorized'
    )
    expect(allowed.calls).toEqual(['status'])
  })
})
