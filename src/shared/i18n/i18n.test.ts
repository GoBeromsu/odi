import { expect, test } from 'vitest'
import { coerceSettings } from '../settings.ts'
import {
  en,
  fmtDate,
  fmtDuration,
  fmtRelativeDay,
  ko,
  localeTag,
  resolveLanguage,
  systemLocale,
  t,
} from './index.ts'

test('both dictionaries carry exactly the same keys', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(ko).sort())
  expect(Object.values(ko).every(v => v.length > 0)).toBe(true)
  expect(Object.values(en).every(v => v.length > 0)).toBe(true)
})

test('the system resolver maps ko-KR to ko and everything else to en', () => {
  expect(systemLocale('ko-KR')).toBe('ko')
  expect(systemLocale('ko')).toBe('ko')
  expect(systemLocale('en-US')).toBe('en')
  expect(systemLocale('ja-JP')).toBe('en')
  expect(systemLocale(undefined)).toBe('en')
  expect(systemLocale(null)).toBe('en')
})

test('an explicit language wins over the system language', () => {
  expect(resolveLanguage('system', 'ko-KR')).toBe('ko')
  expect(resolveLanguage('system', 'ja-JP')).toBe('en')
  expect(resolveLanguage('ko', 'en-US')).toBe('ko')
  expect(resolveLanguage('en', 'ko-KR')).toBe('en')
})

test('a corrupt stored language falls back to system', () => {
  expect(coerceSettings({ language: 'klingon' }).language).toBe('system')
  expect(coerceSettings({ language: 7 }).language).toBe('system')
  expect(coerceSettings({ language: 'en' }).language).toBe('en')
  expect(
    resolveLanguage(coerceSettings({ language: null }).language, 'ko-KR')
  ).toBe('ko')
})

test('t fills variables and leaves unknown placeholders alone', () => {
  expect(t('ko', 'focus.statusRecording', { app: 'Safari' })).toBe(
    '기록 중 · Safari'
  )
  expect(t('en', 'focus.statusRecording', { app: 'Safari' })).toBe(
    'Recording · Safari'
  )
  expect(t('en', 'settings.languageSystem', { resolved: 'English' })).toBe(
    'System (English)'
  )
  expect(t('en', 'focus.statusRecording')).toBe('Recording · {app}')
})

test('t formats numbers with the locale', () => {
  expect(t('en', 'unit.minutes', { minutes: 1500 })).toBe('1,500 minutes')
  expect(t('ko', 'unit.minutes', { minutes: 1500 })).toBe('1,500분')
})

test('durations read naturally in both languages', () => {
  expect(fmtDuration('ko', 3 * 3600 + 240)).toBe('3시간 4분')
  expect(fmtDuration('en', 3 * 3600 + 240)).toBe('3h 4m')
  expect(fmtDuration('ko', 600)).toBe('10분')
  expect(fmtDuration('en', 600)).toBe('10m')
  expect(fmtDuration('en', 42)).toBe('42s')
  expect(fmtDuration('en', -5)).toBe('0s')
})

test('dates use Intl for the resolved locale', () => {
  const date = new Date(2026, 10, 6, 14, 20)
  expect(localeTag('ko')).toBe('ko-KR')
  expect(fmtDate('ko', date, 'day')).toContain('11월')
  expect(fmtDate('en', date, 'day')).toContain('November')
  expect(fmtDate('ko', date, 'month')).toBe('2026년 11월')
  expect(fmtDate('en', date, 'month')).toBe('November 2026')
  expect(fmtDate('en', date, 'time')).toBe('14:20')
})

test('relative days read as today, yesterday and tomorrow', () => {
  const today = new Date(2026, 10, 6, 9, 0)
  const yesterday = new Date(2026, 10, 5, 23, 30)
  const tomorrow = new Date(2026, 10, 7, 1, 0)
  const far = new Date(2026, 10, 1, 9, 0)
  expect(fmtRelativeDay('en', today, today)).toBe('Today')
  expect(fmtRelativeDay('ko', today, today)).toBe('오늘')
  expect(fmtRelativeDay('en', yesterday, today)).toBe('Yesterday')
  expect(fmtRelativeDay('ko', yesterday, today)).toBe('어제')
  expect(fmtRelativeDay('en', tomorrow, today)).toBe('Tomorrow')
  expect(fmtRelativeDay('ko', tomorrow, today)).toBe('내일')
  expect(fmtRelativeDay('en', far, today)).toContain('November')
  expect(fmtRelativeDay('ko', far, today)).toContain('11월')
})
