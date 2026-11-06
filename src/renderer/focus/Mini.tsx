import { useEffect, useState } from 'react'
import type { Health, View } from '../../shared/api.ts'
import { clock } from '../../shared/time.ts'
import { useT } from '../i18n.ts'
import { Glyph } from '../ui/Glyph.tsx'
import './focus.css'

const { ody } = window

export function Mini() {
  const { t } = useT()
  const [view, setView] = useState<View | null>(null)
  const [health, setHealth] = useState<Health>({ state: 'recording' })

  useEffect(() => {
    ody.onState(setView)
    ody.onHealth(setHealth)
    void ody.state().then(setView)
    void ody.health().then(setHealth)
  }, [])

  if (!view) {
    return null
  }
  const label = t('focus.openPopover')

  return (
    <button
      type="button"
      className="mini press"
      data-mini=""
      aria-label={label}
      title={label}
      onClick={() => void ody.showPopover()}
    >
      <Glyph remaining={view.remaining} mode={view.mode} />
      <span className="mini-time tnum" data-time="">
        {clock(view.remaining)}
      </span>
      <span className="mini-dot" data-health={health.reason ?? health.state} />
    </button>
  )
}
