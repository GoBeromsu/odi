import { useEffect, useState } from 'react'
import {
  AppWindow,
  Bell,
  Check,
  Globe,
  Minus,
  Power,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import type { OnboardingStep, StepState } from '../../shared/api.ts'
import type { MessageKey } from '../../shared/i18n/index.ts'
import { useT } from '../i18n.ts'
import { useSettings } from '../skin.ts'
import { Button } from '../ui/Button.tsx'
import { Dial } from '../ui/Dial.tsx'
import { Icon } from '../ui/Icon.tsx'
import { LanguageSelect } from '../ui/LanguageSelect.tsx'
import './onboarding.css'

const { ody } = window

interface StepCopy {
  step: OnboardingStep
  icon: LucideIcon
  label: MessageKey
  hint: MessageKey
}

const STEPS: readonly StepCopy[] = [
  {
    step: 'frontApp',
    icon: AppWindow,
    label: 'onboarding.appUsage',
    hint: 'onboarding.appUsageHint',
  },
  {
    step: 'browsers',
    icon: Globe,
    label: 'onboarding.browserDomains',
    hint: 'onboarding.browserDomainsHint',
  },
  {
    step: 'notifications',
    icon: Bell,
    label: 'onboarding.notifications',
    hint: 'onboarding.notificationsHint',
  },
  {
    step: 'loginItem',
    icon: Power,
    label: 'onboarding.loginItem',
    hint: 'onboarding.loginItemHint',
  },
]

const EMPTY: Record<OnboardingStep, StepState> = {
  frontApp: 'idle',
  browsers: 'idle',
  notifications: 'idle',
  loginItem: 'idle',
}

export function Onboarding() {
  const { t } = useT()
  const settings = useSettings()
  const [states, setStates] = useState(EMPTY)
  const [running, setRunning] = useState(false)
  const done = STEPS.every(
    entry => states[entry.step] === 'granted' || states[entry.step] === 'denied'
  )

  useEffect(() => {
    ody.onOnboardingStep(progress => {
      setStates(current => ({ ...current, [progress.step]: progress.state }))
    })
  }, [])

  const allow = async () => {
    setRunning(true)
    await ody.grantAll()
    setRunning(false)
  }

  const grant = async (step: OnboardingStep) => {
    setRunning(true)
    await ody.grantStep(step)
    setRunning(false)
  }

  return (
    <main className="onb" data-onboarding="">
      <header className="onb-hero">
        <div className="onb-mark">
          <Dial
            dial="disc"
            remaining={1500}
            mode="focus"
            label={t('app.name')}
            brand={t('app.name').toUpperCase()}
            size={72}
            wedge={70}
            numbers={false}
          />
        </div>
        <h1>{t('onboarding.title')}</h1>
        <p>{t('onboarding.subtitle')}</p>
      </header>

      <ul className="onb-list" data-steps="">
        {STEPS.map(entry => (
          <li key={entry.step}>
            <button
              type="button"
              className="onb-item press"
              data-step={entry.step}
              disabled={running || states[entry.step] === 'granted'}
              onClick={() => void grant(entry.step)}
            >
              <span className="onb-icon">
                <Icon of={entry.icon} />
              </span>
              <span className="onb-text">
                <b>{t(entry.label)}</b>
                <small>{t(entry.hint)}</small>
              </span>
              <span
                className="onb-state"
                data-state={states[entry.step]}
                role="status"
              >
                {states[entry.step] === 'granted' ? <Icon of={Check} /> : null}
                {states[entry.step] === 'denied' ? <Icon of={Minus} /> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="onb-language">
        <LanguageSelect onChange={value => void ody.setLanguage(value)} />
      </div>

      <footer className="onb-foot">
        <button
          type="button"
          className="onb-later press"
          data-later=""
          onClick={() => void ody.finishOnboarding(true)}
        >
          {t('onboarding.later')}
        </button>
        <Button
          variant="primary"
          icon={ShieldCheck}
          data-allow=""
          disabled={running}
          onClick={() => {
            if (done) {
              void ody.finishOnboarding(false)
            } else {
              void allow()
            }
          }}
        >
          {t(done ? 'onboarding.done' : 'onboarding.allow')}
        </Button>
      </footer>
      <p className="onb-note" data-language-setting={settings.language}>
        {t('onboarding.note')}
      </p>
    </main>
  )
}
