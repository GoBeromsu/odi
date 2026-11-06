import type { ReactElement } from 'react'
import { CalendarCheck, Inbox, Zap } from 'lucide-react'
import { useT } from '../i18n.ts'
import { Button } from '../ui/Button.tsx'
import { Empty } from '../ui/Empty.tsx'
import { Icon } from '../ui/Icon.tsx'
import { hueVar } from './hues.ts'
import {
  addDays,
  daysBetween,
  endOf,
  midnight,
  sameDay,
  startOf,
  weekIndex,
  type Range,
} from './range.ts'
import {
  appName,
  byDay,
  dayFrom,
  focusBands,
  hourWindow,
  insideFocus,
  totalsOf,
  type DaySummary,
} from './summary.ts'
import type { ActivityData } from './useActivity.ts'

export interface ViewProps {
  date: Date
  today: Date
  data: ActivityData
  onPick: (date: Date, range: Range) => void
}

const MIN_ITEM_SECONDS = 60
const HEAT_WEEKS = 53

const pct = (value: number) => `${value}%`

function NoRecords({
  future,
  onToday,
}: {
  future: boolean
  onToday: () => void
}) {
  const { t } = useT()
  return (
    <Empty
      icon={Inbox}
      message={t(future ? 'activity.emptyFuture' : 'activity.emptyDay')}
      action={
        <Button variant="secondary" icon={CalendarCheck} onClick={onToday}>
          {t('activity.goToToday')}
        </Button>
      }
    />
  )
}

export function DayView({ date, today, data, onPick }: ViewProps) {
  const { date: fmt, duration } = useT()
  const bands = focusBands(data.sessions)
  const { first, last } = hourWindow(data.events, data.from)
  const base = data.from + first * 3600
  const span = Math.max(3600, (last - first) * 3600)
  const place = (seconds: number) => ((seconds - base) / span) * 100
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i)
  const items = data.events.filter(
    e => e.kind === 'active' && e.end - e.start >= MIN_ITEM_SECONDS
  )
  const clock = (seconds: number) => fmt(new Date(seconds * 1000), 'time')

  if (data.events.length === 0) {
    return (
      <div className="act-canvas" data-view="day">
        <NoRecords
          future={midnight(date) > midnight(today)}
          onToday={() => onPick(today, 'day')}
        />
      </div>
    )
  }

  return (
    <div className="act-canvas" data-view="day">
      <div className="act-ribbon">
        {hours.map(hour => (
          <div
            key={hour}
            className="act-hour"
            style={{ top: pct(place(data.from + hour * 3600)) }}
          >
            <span className="tnum">{clock(data.from + hour * 3600)}</span>
          </div>
        ))}
        {bands.map(band => (
          <div
            key={band.start}
            className="act-focus-band"
            data-focus-band=""
            style={{
              top: pct(place(band.start)),
              height: pct(Math.max(0.4, place(band.end) - place(band.start))),
            }}
          />
        ))}
        {data.events.map(event => (
          <div
            key={event.id + '-' + event.start}
            className="act-block"
            data-kind={event.kind}
            data-block=""
            title={`${event.app ?? ''}${event.domain ? ' · ' + event.domain : ''} ${clock(event.start)}–${clock(event.end)}`}
            style={{
              top: pct(place(event.start)),
              height: pct(Math.max(0.3, place(event.end) - place(event.start))),
              background:
                event.kind === 'active'
                  ? hueVar(event.app ?? '')
                  : undefined,
            }}
          />
        ))}
      </div>
      <ul className="act-items" data-items="">
        {items.map(event => (
          <li
            key={event.id + '-' + event.start}
            className="act-item"
            title={`${event.app ?? ''}${event.domain ? ' · ' + event.domain : ''} ${clock(event.start)}–${clock(event.end)}`}
          >
            <i
              className="act-swatch"
              style={{ background: hueVar(event.app ?? '') }}
            />
            <span>{event.app}</span>
            {event.domain ? (
              <span className="act-domain">{event.domain}</span>
            ) : null}
            {insideFocus(event, bands) ? (
              <span className="act-zap" data-zap="">
                <Icon of={Zap} />
              </span>
            ) : null}
            <span className="act-item-time tnum">
              {clock(event.start)}–{clock(event.end)}
            </span>
            <span className="act-item-length tnum">
              {duration(event.end - event.start)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function WeekView({ date, today, data, onPick }: ViewProps) {
  const { date: fmt, duration } = useT()
  const days = byDay(
    daysBetween(startOf(date, 'week'), endOf(date, 'week')),
    data.events,
    data.sessions
  )
  const { first, last } = hourWindow(
    days.flatMap(d => d.events),
    dayFrom(days[0].day)
  )
  const base = first * 3600
  const span = Math.max(3600, (last - first) * 3600)

  return (
    <div className="act-canvas" data-view="week">
      <div className="act-week">
        {days.map(day => (
          <button
            type="button"
            key={day.key}
            className="act-col press"
            data-day={day.key}
            data-today={sameDay(day.day, today)}
            onClick={() => onPick(day.day, 'day')}
          >
            <span className="act-col-head">
              {fmt(day.day, 'weekday')} {day.day.getDate()}
              <b className="tnum" data-seconds={Math.round(day.active)}>
                {day.active > 0 ? duration(day.active) : '—'}
              </b>
            </span>
            <span className="act-col-blocks">
              {day.events.map(event => (
                <i
                  key={event.id + '-' + event.start}
                  className="act-block"
                  data-kind={event.kind}
                  style={{
                    top: pct(
                      ((event.start - dayFrom(day.day) - base) / span) * 100
                    ),
                    height: pct(
                      Math.max(0.3, ((event.end - event.start) / span) * 100)
                    ),
                    background:
                      event.kind === 'active'
                        ? hueVar(event.app ?? '')
                        : undefined,
                  }}
                />
              ))}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function MonthView({ date, today, data, onPick }: ViewProps) {
  const { date: fmt, duration, t } = useT()
  const from = startOf(date, 'month')
  const lead = weekIndex(from)
  const firstCell = addDays(from, -lead)
  const cells = byDay(
    Array.from({ length: 42 }, (_, i) => addDays(firstCell, i)),
    data.events,
    data.sessions
  )
  const names = Array.from({ length: 7 }, (_, i) =>
    fmt(addDays(firstCell, i), 'weekday')
  )

  return (
    <div className="act-canvas" data-view="month">
      <div className="act-month">
        {names.map(name => (
          <div className="act-dayname" key={name}>
            {name}
          </div>
        ))}
        {cells.map(cell => {
          const outside = cell.day.getMonth() !== from.getMonth()
          return (
            <button
              type="button"
              key={cell.key}
              className="act-cell press"
              data-day={cell.key}
              data-outside={outside}
              data-today={sameDay(cell.day, today)}
              disabled={outside}
              onClick={() => onPick(cell.day, 'day')}
            >
              <span className="act-cell-head">
                {cell.day.getDate()}
                <span className="tnum" data-seconds={Math.round(cell.active)}>
                  {cell.active > 0 ? duration(cell.active) : ''}
                </span>
              </span>
              {cell.active > 0 ? (
                <span className="act-cell-bar">
                  {cell.totals.map(total => (
                    <u
                      key={appName(total)}
                      style={{
                        width: pct((total.seconds / cell.active) * 100),
                        background: hueVar(appName(total)),
                      }}
                    />
                  ))}
                </span>
              ) : null}
              {cell.focus > 0 ? (
                <span className="act-cell-focus tnum">
                  {t('activity.focusAmount', { duration: duration(cell.focus) })}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MonthCards({
  months,
  data,
  onPick,
}: {
  months: Date[]
  data: ActivityData
  onPick: ViewProps['onPick']
}) {
  const { date: fmt, duration, t } = useT()
  return (
    <div className="act-month-cards">
      {months.map(month => {
        const days = byDay(
          daysBetween(month, endOf(month, 'month')),
          data.events,
          data.sessions
        )
        const active = days.reduce((sum, d) => sum + d.active, 0)
        const focus = days.reduce((sum, d) => sum + d.focus, 0)
        return (
          <button
            type="button"
            key={month.getTime()}
            className="act-month-card press"
            data-month={month.getMonth() + 1}
            data-empty={active === 0}
            onClick={() => onPick(month, 'month')}
          >
            <small>{fmt(month, 'monthShort')}</small>
            <b className="tnum" data-seconds={Math.round(active)}>
              {active > 0 ? duration(active) : '—'}
            </b>
            <span className="act-month-focus tnum">
              {active > 0
                ? t('activity.focusAmount', { duration: duration(focus) })
                : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function QuarterView({ date, data, onPick }: ViewProps) {
  const { date: fmt, duration, t } = useT()
  const from = startOf(date, 'quarter')
  const to = endOf(date, 'quarter')
  const weeks: { start: Date; days: DaySummary[] }[] = []
  for (let week = startOf(from, 'week'); week <= to; week = addDays(week, 7)) {
    weeks.push({
      start: week,
      days: byDay(
        daysBetween(week, addDays(week, 6)).filter(d => d >= from && d <= to),
        data.events,
        data.sessions
      ),
    })
  }
  const amounts = weeks.map(w => w.days.reduce((sum, d) => sum + d.active, 0))
  const peak = Math.max(...amounts, 1)
  const months = [0, 1, 2].map(
    i => new Date(from.getFullYear(), from.getMonth() + i, 1)
  )

  return (
    <div className="act-canvas" data-view="quarter">
      <div className="act-quarter">
        <h3 className="act-h4">{t('activity.weeklyActivity')}</h3>
        <div className="act-bars">
          {weeks.map((week, i) => {
            const active = amounts[i]
            const totals = totalsOf(week.days.flatMap(d => d.events))
            return (
              <button
                type="button"
                key={week.start.getTime()}
                className="act-bar press"
                data-week={week.start.getTime()}
                data-seconds={Math.round(active)}
                data-empty={active === 0}
                title={`${fmt(week.start, 'day')} · ${duration(active)}`}
                style={{ height: pct(active > 0 ? (active / peak) * 100 : 3) }}
                onClick={() => onPick(week.start, 'week')}
              >
                {totals.map(total => (
                  <u
                    key={appName(total)}
                    style={{
                      height: pct((total.seconds / (active || 1)) * 100),
                      background: hueVar(appName(total)),
                    }}
                  />
                ))}
              </button>
            )
          })}
        </div>
        <div className="act-bar-labels">
          {weeks.map(week => (
            <span key={week.start.getTime()} className="tnum">
              {week.start.getMonth() + 1}/{week.start.getDate()}
            </span>
          ))}
        </div>
        <MonthCards months={months} data={data} onPick={onPick} />
      </div>
    </div>
  )
}

export function YearView({ date, today, data, onPick }: ViewProps) {
  const { t, date: fmt, duration } = useT()
  const from = startOf(date, 'year')
  const firstCell = startOf(from, 'week')
  const cells = byDay(
    Array.from({ length: HEAT_WEEKS * 7 }, (_, i) => addDays(firstCell, i)),
    data.events,
    data.sessions
  )
  const months = Array.from(
    { length: 12 },
    (_, i) => new Date(from.getFullYear(), i, 1)
  )
  const level = (seconds: number) => {
    if (seconds === 0) {
      return 0
    }
    const hours = seconds / 3600
    return hours < 2 ? 30 : hours < 4 ? 55 : hours < 6 ? 78 : 100
  }

  return (
    <div className="act-canvas" data-view="year">
      <div className="act-year">
        <h3 className="act-h4">
          {t('activity.dailyActivity', { year: from.getFullYear() })}
        </h3>
        <div className="act-heat">
          {cells.map(cell => {
            const shade = level(cell.active)
            const inside = cell.day.getFullYear() === from.getFullYear()
            return (
              <button
                type="button"
                key={cell.key}
                className="act-heat-cell"
                data-heat={cell.key}
                data-seconds={Math.round(cell.active)}
                title={`${fmt(cell.day, 'day')} · ${duration(cell.active)}`}
                disabled={!inside || cell.day > today}
                style={{
                  background: shade
                    ? `color-mix(in srgb, var(--acc) ${shade}%, var(--line))`
                    : 'var(--line)',
                  opacity: inside && cell.day <= today ? 1 : 0.35,
                }}
                onClick={() => onPick(cell.day, 'day')}
              />
            )
          })}
        </div>
        <MonthCards months={months} data={data} onPick={onPick} />
      </div>
    </div>
  )
}

export const VIEWS: Record<Range, (props: ViewProps) => ReactElement> = {
  day: DayView,
  week: WeekView,
  month: MonthView,
  quarter: QuarterView,
  year: YearView,
}
