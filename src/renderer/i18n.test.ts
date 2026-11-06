import { act, createElement as h } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { LanguageView } from '../shared/api.ts'
import { connectLanguage, setLanguageView, useT } from './i18n.ts'

const TODAY = new Date(2026, 10, 6, 9, 0)

function Probe() {
  const { t, relativeDay, duration, date, locale } = useT()
  return h(
    'dl',
    null,
    h('dt', { 'data-locale': '' }, locale),
    h('dd', { 'data-today': '' }, relativeDay(TODAY, TODAY)),
    h('dd', { 'data-label': '' }, t('activity.heroFocus')),
    h('dd', { 'data-duration': '' }, duration(3 * 3600 + 240)),
    h('dd', { 'data-date': '' }, date(TODAY, 'month'))
  )
}

let host: HTMLDivElement
let root: Root

const text = (selector: string) =>
  host.querySelector(selector)?.textContent ?? ''

beforeEach(() => {
  setLanguageView({ setting: 'system', system: 'ko', locale: 'ko' })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

test('useT renders the resolved language and follows later changes', () => {
  act(() => root.render(h(Probe)))
  expect(text('[data-locale]')).toBe('ko')
  expect(text('[data-today]')).toBe('\uc624\ub298')
  expect(text('[data-label]')).toBe('\uc9d1\uc911')
  expect(text('[data-duration]')).toBe('3\uc2dc\uac04 4\ubd84')
  expect(text('[data-date]')).toBe('2026\ub144 11\uc6d4')

  act(() => setLanguageView({ setting: 'en', system: 'ko', locale: 'en' }))
  expect(text('[data-locale]')).toBe('en')
  expect(text('[data-today]')).toBe('Today')
  expect(text('[data-label]')).toBe('Focus')
  expect(text('[data-duration]')).toBe('3h 4m')
  expect(text('[data-date]')).toBe('November 2026')
})

test('the system setting follows the resolved system language', () => {
  act(() => root.render(h(Probe)))
  expect(text('[data-today]')).toBe('\uc624\ub298')

  act(() => setLanguageView({ setting: 'system', system: 'en', locale: 'en' }))
  expect(text('[data-locale]')).toBe('en')
  expect(text('[data-today]')).toBe('Today')
})

test('connectLanguage wires the store to the preload bridge', async () => {
  let push: ((view: LanguageView) => void) | null = null
  act(() => root.render(h(Probe)))
  await act(async () => {
    await connectLanguage({
      language: async () => ({ setting: 'system', system: 'en', locale: 'en' }),
      onLanguage: cb => {
        push = cb
      },
    })
  })
  expect(text('[data-locale]')).toBe('en')
  expect(push).not.toBeNull()
  act(() => push!({ setting: 'ko', system: 'en', locale: 'ko' }))
  expect(text('[data-locale]')).toBe('ko')
  expect(text('[data-label]')).toBe('\uc9d1\uc911')
})
