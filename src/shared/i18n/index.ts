import type { Language } from '../settings.ts'
import { en } from './en.ts'
import { ko } from './ko.ts'

export type Locale = 'ko' | 'en'
export type Dict = typeof ko
export type MessageKey = keyof Dict
export type Vars = Record<string, string | number>
export type DateStyle =
  | 'day'
  | 'weekday'
  | 'month'
  | 'monthShort'
  | 'time'
  | 'full'

const DICTS: Record<Locale, Dict> = { ko, en }
const DAY = 86400000

export const localeTag = (locale: Locale) =>
  locale === 'ko' ? 'ko-KR' : 'en-US'

export const systemLocale = (preferred?: string | null): Locale =>
  String(preferred ?? '')
    .toLowerCase()
    .startsWith('ko')
    ? 'ko'
    : 'en'

export const resolveLanguage = (
  setting: Language,
  preferred?: string | null
): Locale => (setting === 'system' ? systemLocale(preferred) : setting)

const number = (locale: Locale, value: number) =>
  new Intl.NumberFormat(localeTag(locale)).format(value)

const fill = (template: string, locale: Locale, vars?: Vars) =>
  template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = vars?.[name]
    if (value === undefined) {
      return whole
    }
    return typeof value === 'number' ? number(locale, value) : value
  })

export function t(locale: Locale, key: MessageKey, vars?: Vars) {
  return fill(DICTS[locale][key], locale, vars)
}

export function fmtDuration(locale: Locale, seconds: number) {
  const whole = Math.max(0, Math.round(seconds))
  if (whole >= 3600) {
    return t(locale, 'unit.hoursMinutes', {
      hours: Math.floor(whole / 3600),
      minutes: Math.round((whole % 3600) / 60),
    })
  }
  if (whole >= 60) {
    return t(locale, 'unit.minutesShort', { minutes: Math.round(whole / 60) })
  }
  return t(locale, 'unit.secondsShort', { seconds: whole })
}

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  day: { month: 'long', day: 'numeric', weekday: 'short' },
  weekday: { weekday: 'short' },
  month: { year: 'numeric', month: 'long' },
  monthShort: { month: 'short' },
  time: { hour: '2-digit', minute: '2-digit', hour12: false },
  full: { dateStyle: 'full' },
}

export function fmtDate(locale: Locale, date: Date, style: DateStyle = 'day') {
  return new Intl.DateTimeFormat(localeTag(locale), DATE_OPTIONS[style]).format(
    date
  )
}

const midnight = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

const upperFirst = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1)

export function fmtRelativeDay(
  locale: Locale,
  date: Date,
  today: Date = new Date()
) {
  const days = Math.round((midnight(date) - midnight(today)) / DAY)
  if (days < -1 || days > 1) {
    return fmtDate(locale, date, 'day')
  }
  const relative = new Intl.RelativeTimeFormat(localeTag(locale), {
    numeric: 'auto',
  }).format(days, 'day')
  return locale === 'en' ? upperFirst(relative) : relative
}

export { en, ko }
