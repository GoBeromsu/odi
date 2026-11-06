import { useEffect, useRef, useState } from 'react'
import { Coffee, Pause, Play, Square, Target } from 'lucide-react'
import type { Mode, View } from '../../shared/api.ts'
import { clock } from '../../shared/time.ts'
import { useT } from '../i18n.ts'
import { useSettings } from '../skin.ts'
import { Dial } from '../ui/Dial.tsx'
import { Icon } from '../ui/Icon.tsx'
import { IconButton } from '../ui/IconButton.tsx'

const { ody } = window

const ZEN_DIAL = 320
const ZEN_WEDGE = 70

export interface FocusTabProps {
  onStarted: () => void
}

export function FocusTab({ onStarted }: FocusTabProps) {
  const { t } = useT()
  const settings = useSettings()
  const [view, setView] = useState<View | null>(null)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    ody.onState(setView)
    void ody.state().then(setView)
  }, [])

  const idle = view === null || view.phase === 'idle'
  const running = view !== null && (view.phase === 'running' || view.phase === 'overtime')

  const begin = (mode: Mode) => {
    const minutes =
      mode === 'focus' ? settings.focusMinutes : settings.breakMinutes
    setPicking(false)
    onStarted()
    void ody.start(mode, minutes * 60)
  }

  const toggle = () => {
    if (idle) {
      setPicking(open => !open)
      return
    }
    if (view !== null && view.phase === 'paused') {
      void ody.resume()
      return
    }
    void ody.pause()
  }

  const actions = useRef({ begin, toggle, idle, picking })
  useEffect(() => {
    actions.current = { begin, toggle, idle, picking }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const now = actions.current
      if (e.key === 'Enter') {
        e.preventDefault()
        if (now.picking) {
          now.begin('focus')
        } else {
          now.toggle()
        }
        return
      }
      if (e.key.toLowerCase() === 'b' && now.picking) {
        now.begin('break')
        return
      }
      if (e.key === 'Escape') {
        if (now.picking) {
          setPicking(false)
        } else if (!now.idle) {
          void ody.stop()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!view) {
    return null
  }

  return (
    <div
      className="act-main zen"
      data-tab="focus"
      data-zen=""
      data-mode={view.mode}
      data-running={running}
      data-picking={picking}
    >
      <Dial
        dial={settings.dial}
        remaining={view.remaining}
        mode={view.mode}
        label={t('focus.dialLabel')}
        brand={t('app.name').toUpperCase()}
        size={ZEN_DIAL}
        wedge={ZEN_WEDGE}
        numbers={false}
      />
      <p className="zen-time tnum" data-time="">
        {clock(view.remaining)}
      </p>
      {picking ? (
        <div className="zen-choice" data-zen-choice="">
          <button
            type="button"
            className="zen-option press"
            data-choice="focus"
            title={`${t('focus.modeFocus')} (↵)`}
            aria-label={t('focus.modeFocus')}
            onClick={() => begin('focus')}
          >
            <Icon of={Target} size={20} />
            <span className="tnum">{settings.focusMinutes}</span>
          </button>
          <button
            type="button"
            className="zen-option press"
            data-choice="break"
            title={`${t('focus.modeBreak')} (B)`}
            aria-label={t('focus.modeBreak')}
            onClick={() => begin('break')}
          >
            <Icon of={Coffee} size={20} />
            <span className="tnum">{settings.breakMinutes}</span>
          </button>
        </div>
      ) : (
        <div className="zen-controls" data-zen-controls="">
          <IconButton
            icon={running ? Pause : Play}
            label={t(running ? 'focus.pause' : 'focus.start')}
            shortcut="↵"
            size={20}
            className="zen-button"
            data-zen-play=""
            onClick={toggle}
          />
          {idle ? null : (
            <IconButton
              icon={Square}
              label={t('focus.stop')}
              shortcut="Esc"
              size={20}
              className="zen-button zen-ghost"
              data-zen-stop=""
              onClick={() => void ody.stop()}
            />
          )}
        </div>
      )}
    </div>
  )
}
