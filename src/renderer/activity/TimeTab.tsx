import { useEffect, useRef, useState } from 'react'
import {
  Calendar,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
} from 'lucide-react'
import type { MessageKey } from '../../shared/i18n/index.ts'
import { useT } from '../i18n.ts'
import { Button } from '../ui/Button.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import { DatePicker } from './DatePicker.tsx'
import { Hero } from './Hero.tsx'
import { Totals } from './Totals.tsx'
import {
  atPresent,
  daysBetween,
  endOf,
  midnight,
  quarterOf,
  RANGES,
  sameDay,
  shift,
  startOf,
  type Range,
} from './range.ts'
import { activeSeconds, byDay, focusSeconds } from './summary.ts'
import { useActivity } from './useActivity.ts'
import { VIEWS } from './views.tsx'

const RANGE_LABEL: Record<Range, MessageKey> = {
  day: 'activity.rangeDay',
  week: 'activity.rangeWeek',
  month: 'activity.rangeMonth',
  quarter: 'activity.rangeQuarter',
  year: 'activity.rangeYear',
}

export interface TimeTabProps {
  date: Date
  range: Range
  today: Date
  collapsed: boolean
  onToggleSidebar: () => void
  onPick: (date: Date, range: Range) => void
  onRange: (range: Range) => void
}

export function TimeTab({
  date,
  range,
  today,
  collapsed,
  onToggleSidebar,
  onPick,
  onRange,
}: TimeTabProps) {
  const { t, date: fmt, duration, relativeDay } = useT()
  const data = useActivity(date, range)
  const [picker, setPicker] = useState(false)
  const View = VIEWS[range]
  const next = shift(date, range, 1)
  const canGoForward = !atPresent(date, range, today)

  const forward = midnight(next) > midnight(today) ? today : next
  const nav = useRef({ date, range, today, canGoForward, forward, onPick })
  useEffect(() => {
    nav.current = { date, range, today, canGoForward, forward, onPick }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const now = nav.current
      if (e.key === 'Escape') {
        setPicker(false)
        return
      }
      if (e.metaKey && (e.key === '[' || e.key === ']')) {
        e.preventDefault()
        const step = e.key === '[' ? -1 : 1
        const moved = shift(now.date, 'day', step)
        if (step < 0 || midnight(moved) <= midnight(now.today)) {
          now.onPick(moved, 'day')
        }
        return
      }
      if (e.metaKey) {
        return
      }
      if (e.key === 'ArrowLeft') {
        now.onPick(shift(now.date, now.range, -1), now.range)
        return
      }
      if (e.key === 'ArrowRight') {
        if (now.canGoForward) {
          now.onPick(now.forward, now.range)
        }
        return
      }
      if (e.key.toLowerCase() === 't') {
        now.onPick(now.today, 'day')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const label = () => {
    if (range === 'day') {
      return relativeDay(date, today)
    }
    if (range === 'week') {
      return t('activity.weekLabel', {
        from: fmt(startOf(date, 'week'), 'day'),
        to: fmt(endOf(date, 'week'), 'day'),
      })
    }
    if (range === 'month') {
      return fmt(date, 'month')
    }
    if (range === 'quarter') {
      return t('activity.quarterLabel', {
        year: date.getFullYear(),
        quarter: quarterOf(date),
      })
    }
    return t('activity.yearLabel', { year: date.getFullYear() })
  }

  const days = byDay(
    daysBetween(startOf(date, range), endOf(date, range)),
    data.events,
    data.sessions
  )
  const recorded = days.filter(d => d.active > 0).length
  const active = activeSeconds(data.events)
  const extra =
    range === 'day'
      ? {
          name: 'switches',
          label: t('activity.heroSwitches'),
          value: String(data.events.filter(e => e.kind === 'active').length),
        }
      : range === 'week'
        ? {
            name: 'dailyAverage',
            label: t('activity.heroDailyAverage'),
            value: duration(active / Math.max(1, recorded)),
          }
        : range === 'quarter'
          ? {
              name: 'weeklyAverage',
              label: t('activity.heroWeeklyAverage'),
              value: duration(active / Math.max(1, Math.ceil(recorded / 7))),
            }
          : {
              name: 'recordedDays',
              label: t('activity.heroRecordedDays'),
              value: String(recorded),
            }

  return (
    <div className="act-main" data-tab="time">
      <header className="act-head">
        <IconButton
          icon={PanelLeft}
          label={t('activity.toggleSidebar')}
          shortcut="Cmd+\"
          data-toggle-sidebar=""
          aria-expanded={!collapsed}
          onClick={onToggleSidebar}
        />
        <Button
          variant="secondary"
          className="act-date-button"
          data-date-button=""
          aria-expanded={picker}
          onClick={() => setPicker(open => !open)}
        >
          <span className="tnum">{label()}</span>
        </Button>
        <IconButton
          icon={Calendar}
          label={t('activity.datePicker')}
          data-open-picker=""
          onClick={() => setPicker(open => !open)}
        />
        <IconButton
          icon={ChevronLeft}
          label={t('activity.previous')}
          shortcut="←"
          data-step="-1"
          onClick={() => onPick(shift(date, range, -1), range)}
        />
        <IconButton
          icon={ChevronRight}
          label={t('activity.next')}
          shortcut="→"
          data-step="1"
          disabled={!canGoForward}
          onClick={() => onPick(forward, range)}
        />
        <Button
          variant="secondary"
          icon={CalendarCheck}
          data-today=""
          disabled={range === 'day' && sameDay(date, today)}
          onClick={() => onPick(today, 'day')}
        >
          {t('activity.today')}
        </Button>
        <span className="act-spacer" />
        <div className="act-segment" role="group" data-ranges="">
          {RANGES.map(value => (
            <button
              type="button"
              key={value}
              className="press"
              data-range={value}
              aria-pressed={value === range}
              onClick={() => onRange(value)}
            >
              {t(RANGE_LABEL[value])}
            </button>
          ))}
        </div>
      </header>

      <Hero
        active={active}
        focus={focusSeconds(data.sessions)}
        extra={extra}
        totals={data.totals}
      />

      <div
        className="act-body"
        data-ready={data.ready}
        data-body-range={range}
        data-from={data.from}
        data-to={data.to}
      >
        <View date={date} today={today} data={data} onPick={onPick} />
        <Totals totals={data.totals} />
      </div>

      <DatePicker
        date={date}
        today={today}
        open={picker}
        onPick={(picked, pickedRange) => {
          setPicker(false)
          onPick(picked, pickedRange)
        }}
      />
    </div>
  )
}
