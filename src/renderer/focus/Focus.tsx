import { useEffect, useRef, useState } from 'react'
import {
  Coffee,
  PanelsTopLeft,
  Pause,
  Play,
  Settings as SettingsIcon,
  Square,
  Target,
} from 'lucide-react'
import type { Health, Mode, Phase, View } from '../../shared/api.ts'
import type { MessageKey } from '../../shared/i18n/index.ts'
import {
  BREAK_MINUTE_OPTIONS,
  FOCUS_MINUTE_OPTIONS,
} from '../../shared/settings.ts'
import { clock } from '../../shared/time.ts'
import { useT } from '../i18n.ts'
import { useSettings } from '../skin.ts'
import { Button } from '../ui/Button.tsx'
import { Dial } from '../ui/Dial.tsx'
import { Icon } from '../ui/Icon.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import { Kbd } from '../ui/Kbd.tsx'
import { Popup } from '../ui/Popup.tsx'
import './focus.css'

const { ody } = window

const PRIMARY: Record<Phase, { label: MessageKey; icon: typeof Play }> = {
  idle: { label: 'focus.start', icon: Play },
  running: { label: 'focus.pause', icon: Pause },
  paused: { label: 'focus.resume', icon: Play },
  overtime: { label: 'focus.pause', icon: Pause },
}

const STATUS: Record<Phase, MessageKey> = {
  idle: 'focus.statusIdle',
  running: 'focus.statusFocus',
  paused: 'focus.statusPaused',
  overtime: 'focus.statusOvertimeFocus',
}

const BREAK_STATUS: Partial<Record<Phase, MessageKey>> = {
  running: 'focus.statusBreak',
  overtime: 'focus.statusOvertimeBreak',
}

const HEALTH_LABEL: Record<string, MessageKey> = {
  recording: 'tray.recording',
  paused: 'tray.paused',
  'automation-denied': 'tray.automationDenied',
  'tracker-failed': 'tray.trackerFailed',
}

const statusKey = (view: View): MessageKey => {
  if (view.mode === 'break' && view.phase !== 'idle') {
    return BREAK_STATUS[view.phase] ?? STATUS[view.phase]
  }
  return STATUS[view.phase]
}

export function Focus() {
  const { t } = useT()
  const settings = useSettings()
  const [view, setView] = useState<View | null>(null)
  const [health, setHealth] = useState<Health>({ state: 'recording' })
  const [sheet, setSheet] = useState(false)
  const [chosenFocus, setChosenFocus] = useState<number | null>(null)
  const [chosenBreak, setChosenBreak] = useState<number | null>(null)
  const [preferBreak, setPreferBreak] = useState(false)
  const previous = useRef<View | null>(null)
  const focusMinutes = chosenFocus ?? settings.focusMinutes
  const breakMinutes = chosenBreak ?? settings.breakMinutes

  useEffect(() => {
    ody.onState(setView)
    ody.onHealth(setHealth)
    ody.onSheet(() => setSheet(true))
    void ody.state().then(setView)
    void ody.health().then(setHealth)
  }, [])

  useEffect(() => {
    const was = previous.current
    previous.current = view
    if (!view || !was) {
      return
    }
    if (view.phase === 'idle' && was.phase !== 'idle') {
      setSheet(false)
      setPreferBreak(settings.suggestBreak && was.mode === 'focus')
    }
  }, [view, settings.suggestBreak])

  const idle = view === null || view.phase === 'idle'

  const start = (mode: Mode) => {
    const minutes = mode === 'focus' ? focusMinutes : breakMinutes
    setSheet(false)
    setPreferBreak(false)
    void ody.start(mode, minutes * 60)
  }

  const starter = useRef(start)

  useEffect(() => {
    starter.current = start
  })

  useEffect(() => {
    const begin = (mode: Mode) => starter.current(mode)
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && target.tagName === 'SELECT') {
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (sheet) {
          begin('focus')
        } else if (idle) {
          setSheet(true)
        }
        return
      }
      if (e.key.toLowerCase() === 'b') {
        if (idle) {
          begin('break')
        }
        return
      }
      if (e.key === 'Escape') {
        setSheet(false)
        return
      }
      if (e.code === 'Space' && !idle) {
        e.preventDefault()
        if (view !== null && view.phase === 'paused') {
          void ody.resume()
        } else {
          void ody.pause()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet, idle, view])

  if (!view) {
    return null
  }

  const primary = PRIMARY[view.phase]
  const remaining = idle ? focusMinutes * 60 : view.remaining
  const fault = health.reason ?? health.state
  const healthLabel = t(HEALTH_LABEL[fault] ?? 'tray.recording')

  const act = () => {
    if (idle) {
      setSheet(open => !open)
      return
    }
    if (view.phase === 'paused') {
      void ody.resume()
      return
    }
    void ody.pause()
  }

  return (
    <main
      className="pop"
      data-phase={view.phase}
      data-mode={view.mode}
      data-running={!idle}
      data-choosing={sheet}
    >
      <header className="pop-top" data-top="">
        <span className="pop-dot" data-health={fault} title={healthLabel} />
        <span className="pop-top-label">{healthLabel}</span>
        <span className="pop-spacer" />
        <IconButton
          icon={PanelsTopLeft}
          label={t('focus.openActivity')}
          onClick={() => void ody.openActivity('time')}
        />
        <IconButton
          icon={SettingsIcon}
          label={t('settings.title')}
          onClick={() => void ody.openActivity('settings')}
        />
      </header>

      <Dial
        dial={settings.dial}
        remaining={remaining}
        mode={view.mode}
        label={t('focus.dialLabel')}
        brand={t('app.name').toUpperCase()}
        size={196}
        onMinutes={idle ? setChosenFocus : undefined}
      />

      <div className="pop-read">
        <p className="pop-time tnum" data-time="">
          {clock(remaining)}
        </p>
        <p className="pop-status" data-status="">
          {t(statusKey(view))}
        </p>
      </div>

      {idle ? null : (
        <span
          className="pop-health"
          data-health={fault}
          data-health-dot=""
          role="status"
          aria-label={healthLabel}
          title={healthLabel}
        />
      )}

      <div className="pop-bottom" data-bottom="">
        <Button
          variant="primary"
          icon={primary.icon}
          shortcut={idle ? '↵' : 'Space'}
          className="pop-primary"
          data-primary=""
          onClick={act}
        >
          {t(primary.label)}
        </Button>
        {idle ? null : (
          <IconButton
            icon={Square}
            label={t('focus.stop')}
            tone="surface"
            className="pop-stop"
            data-stop=""
            onClick={() => void ody.stop()}
          />
        )}
      </div>

      <section className="pop-sheet" data-sheet="" aria-hidden={!sheet}>
        <h2 className="pop-sheet-title">
          <span>{t('focus.sheetTitle')}</span>
          <Kbd>Esc</Kbd>
        </h2>
        <div className="pop-tiles">
          <div className="pop-tile" data-tile="focus" data-default={!preferBreak}>
            <button
              type="button"
              className="pop-tile-head press"
              data-start="focus"
              onClick={() => start('focus')}
            >
              <span className="pop-tile-icon" data-tone="focus">
                <Icon of={Target} />
              </span>
              <span>{t('focus.modeFocus')}</span>
              <Kbd>↵</Kbd>
            </button>
            <Popup
              name="focus-minutes"
              label={t('settings.defaultFocus')}
              value={String(focusMinutes)}
              options={FOCUS_MINUTE_OPTIONS.map(m => ({
                value: String(m),
                label: t('unit.minutesPicker', { minutes: m }),
              }))}
              onChange={value => setChosenFocus(Number(value))}
              compact
            />
          </div>
          <div className="pop-tile" data-tile="break" data-default={preferBreak}>
            <button
              type="button"
              className="pop-tile-head press"
              data-start="break"
              onClick={() => start('break')}
            >
              <span className="pop-tile-icon" data-tone="break">
                <Icon of={Coffee} />
              </span>
              <span>{t('focus.modeBreak')}</span>
              <Kbd>B</Kbd>
            </button>
            <Popup
              name="break-minutes"
              label={t('settings.defaultBreak')}
              value={String(breakMinutes)}
              options={BREAK_MINUTE_OPTIONS.map(m => ({
                value: String(m),
                label: t('unit.minutesPicker', { minutes: m }),
              }))}
              onChange={value => setChosenBreak(Number(value))}
              compact
            />
          </div>
        </div>
      </section>
    </main>
  )
}
