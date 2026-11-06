import { useEffect, useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import type { Phase, View } from '../../shared/api.ts'
import type { MessageKey } from '../../shared/i18n/index.ts'
import { clock } from '../../shared/time.ts'
import { useT } from '../i18n.ts'
import { Button } from '../ui/Button.tsx'
import { IconButton } from '../ui/IconButton.tsx'

const { ody } = window

const ACTION: Record<
  Phase,
  { label: MessageKey; icon: typeof Play; run: () => Promise<void> }
> = {
  idle: { label: 'focus.start', icon: Play, run: () => ody.start('focus') },
  running: { label: 'focus.pause', icon: Pause, run: () => ody.pause() },
  paused: { label: 'focus.resume', icon: Play, run: () => ody.resume() },
  overtime: { label: 'focus.pause', icon: Pause, run: () => ody.pause() },
}

const STATUS: Record<Phase, MessageKey> = {
  idle: 'focus.statusIdle',
  running: 'focus.statusFocus',
  paused: 'focus.statusPaused',
  overtime: 'focus.statusOvertimeFocus',
}

export function Focus() {
  const { t } = useT()
  const [state, setState] = useState<View | null>(null)

  useEffect(() => {
    ody.onState(setState)
    ody.state().then(setState)
  }, [])

  if (!state) {
    return null
  }
  const action = ACTION[state.phase]
  const status =
    state.mode === 'break' && state.phase !== 'idle'
      ? state.phase === 'overtime'
        ? 'focus.statusOvertimeBreak'
        : 'focus.statusBreak'
      : STATUS[state.phase]

  return (
    <main data-phase={state.phase} data-mode={state.mode}>
      <p className="tnum" data-time="">
        {clock(state.remaining)}
      </p>
      <p data-status="">{t(status)}</p>
      <Button
        variant="primary"
        icon={action.icon}
        data-primary=""
        onClick={() => action.run()}
      >
        {t(action.label)}
      </Button>
      {state.phase === 'idle' ? null : (
        <IconButton
          icon={Square}
          label={t('focus.stop')}
          data-stop=""
          onClick={() => ody.stop()}
        />
      )}
    </main>
  )
}
