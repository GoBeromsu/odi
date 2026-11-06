import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '../i18n.ts'
import { Button } from '../ui/Button.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import {
  addDays,
  dayKey,
  endOf,
  midnight,
  sameDay,
  spanOf,
  startOf,
  weekIndex,
  type Range,
} from './range.ts'

const { ody } = window

export interface DatePickerProps {
  date: Date
  today: Date
  open: boolean
  onPick: (date: Date, range: Range) => void
}

export function DatePicker({ date, today, open, onPick }: DatePickerProps) {
  const { t, date: fmt } = useT()
  const [month, setMonth] = useState(startOf(date, 'month'))
  const [recorded, setRecorded] = useState<string[]>([])
  const stamp = month.getTime()

  useEffect(() => {
    let alive = true
    const span = spanOf(new Date(stamp), 'month')
    void ody.recordedDays(span.from, span.to).then(days => {
      if (alive) {
        setRecorded(days)
      }
    })
    return () => {
      alive = false
    }
  }, [stamp])

  const lead = weekIndex(month)
  const length = endOf(month, 'month').getDate()
  const names = Array.from({ length: 7 }, (_, i) =>
    fmt(addDays(startOf(date, 'week'), i), 'weekday')
  )

  return (
    <div className="act-picker" data-picker="" data-open={open} hidden={!open}>
      <header className="act-picker-head">
        <span>{fmt(month, 'month')}</span>
        <IconButton
          icon={ChevronLeft}
          label={t('activity.previous')}
          data-picker-step="-1"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        />
        <IconButton
          icon={ChevronRight}
          label={t('activity.next')}
          data-picker-step="1"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        />
      </header>
      <div className="act-picker-grid">
        {names.map(name => (
          <b key={name}>{name}</b>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {Array.from({ length }, (_, i) => {
          const day = new Date(month.getFullYear(), month.getMonth(), i + 1)
          const key = dayKey(day)
          return (
            <button
              type="button"
              key={key}
              className="act-picker-day tnum"
              data-pick={key}
              data-selected={sameDay(day, date)}
              data-recorded={recorded.includes(key)}
              disabled={midnight(day) > midnight(today)}
              onClick={() => onPick(day, 'day')}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      <div className="act-picker-quick">
        <Button
          variant="secondary"
          data-quick="today"
          onClick={() => onPick(today, 'day')}
        >
          {t('activity.today')}
        </Button>
        <Button
          variant="secondary"
          data-quick="yesterday"
          onClick={() => onPick(addDays(today, -1), 'day')}
        >
          {t('activity.yesterday')}
        </Button>
        <Button
          variant="secondary"
          data-quick="lastWeek"
          onClick={() => onPick(addDays(today, -7), 'week')}
        >
          {t('activity.lastWeek')}
        </Button>
      </div>
    </div>
  )
}
