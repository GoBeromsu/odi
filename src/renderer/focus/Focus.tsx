import { useEffect, useState } from 'react'
import type { Phase, View } from '../../shared/api.ts'
import { mmss } from '../../shared/time.ts'

const { ody } = window

const ACTION: Record<Phase, { label: string; run: () => Promise<void> }> = {
  idle: { label: 'Focus', run: () => ody.start() },
  running: { label: 'Pause', run: () => ody.pause() },
  paused: { label: 'Resume', run: () => ody.resume() },
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
    <main data-phase={state.phase}>
      <h1>ody</h1>
      <p data-time="">{mmss(state.remaining ?? state.planned)}</p>
      <button
        type="button"
        data-primary=""
        aria-label={action.label}
        title={action.label}
        onClick={() => action.run()}
      >
        {action.label}
      </button>
      {state.phase === 'paused' ? (
        <button
          type="button"
          aria-label="Stop"
          title="Stop"
          onClick={() => ody.stop()}
        >
          Stop
        </button>
      ) : null}
    </main>
  )
}
