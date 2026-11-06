import { describe, expect, it } from 'vitest'
import { HUES, hueOf, hueVar } from './hues.ts'

describe('hues', () => {
  it('always lands inside the eight semantic hues', () => {
    const names = ['Cursor', 'Safari', 'Terminal', 'Figma', 'Slack', '', 'ody']
    for (const name of names) {
      expect(HUES).toContain(hueOf(name))
    }
  })

  it('is stable for the same app', () => {
    expect(hueOf('Cursor')).toBe(hueOf('Cursor'))
    expect(hueVar('Safari')).toBe(`var(${hueOf('Safari')})`)
  })

  it('spreads a realistic set of apps over several hues', () => {
    const apps = [
      'Cursor',
      'Safari',
      'Terminal',
      'Figma',
      'Slack',
      'Notion',
      'Mail',
      'Xcode',
    ]
    const used = new Set(apps.map(hueOf))
    expect(used.size).toBeGreaterThanOrEqual(5)
  })
})
