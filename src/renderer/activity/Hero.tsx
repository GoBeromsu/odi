import type { AppTotal } from '../../shared/api.ts'
import { useT } from '../i18n.ts'
import { Stat } from '../ui/Stat.tsx'
import { hueVar } from './hues.ts'
import { appName } from './summary.ts'

export interface HeroExtra {
  name: string
  label: string
  value: string
}

export interface HeroProps {
  active: number
  focus: number
  extra: HeroExtra
  totals: AppTotal[]
}

export function Hero({ active, focus, extra, totals }: HeroProps) {
  const { t, duration } = useT()
  const share = totals.reduce((sum, a) => sum + a.seconds, 0) || 1

  return (
    <div className="act-hero" data-hero="">
      <div data-hero-stat="active" data-seconds={Math.round(active)}>
        <Stat label={t('activity.heroActive')} value={duration(active)} />
      </div>
      <div data-hero-stat="focus" data-seconds={Math.round(focus)}>
        <Stat
          label={t('activity.heroFocus')}
          value={duration(focus)}
          tone="accent"
        />
      </div>
      <div data-hero-stat={extra.name}>
        <Stat label={extra.label} value={extra.value} />
      </div>
      <div className="act-stack" data-stack="">
        {totals.map(total => (
          <u
            key={appName(total)}
            style={{
              width: `${(total.seconds / share) * 100}%`,
              background: hueVar(appName(total)),
            }}
          />
        ))}
      </div>
    </div>
  )
}
