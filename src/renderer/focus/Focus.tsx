import { useEffect, useState } from 'react'
import type { Phase, View } from '../../shared/api.ts'
import { clock } from '../../shared/time.ts'

const { ody } = window

const ACTION: Record<Phase, { label: string; run: () => Promise<void> }> = {
  idle: { label: 'Focus', run: () => ody.start('focus') },
  running: { label: 'Pause', run: () => ody.pause() },
  paused: { label: 'Resume', run: () => ody.resume() },
  overtime: { label: 'Pause', run: () => ody.pause() },
}

export function Focus() {
  const [state, setState] = useState<View | null>(null)

  useEffect(() => {
    ody.onState(setState)
    ody.state().then(setState)
  }, [])

  if (!state) {
    return null
  }
  const action = ACTION[state.phase]
  return (
    <main data-phase={state.phase} data-mode={state.mode}>
      <p data-time="">{clock(state.remaining)}</p>
      <button
        type="button"
        data-primary=""
        aria-label={action.label}
        title={action.label}
        onClick={() => action.run()}
      >
        {action.label}
      </button>
      {state.phase === 'idle' ? null : (
        <button
          type="button"
          data-stop=""
          aria-label="Stop"
          title="Stop"
          onClick={() => ody.stop()}
        >
          Stop
        </button>
      )}
    </main>
  )
}
