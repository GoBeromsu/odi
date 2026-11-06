import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import type { Health, NotifyStatus } from '../../shared/api.ts'
import type { MessageKey } from '../../shared/i18n/index.ts'
import {
  ACCENT_OPTIONS,
  AT_END,
  AUTO_BREAK_MINUTE_OPTIONS,
  BREAK_MINUTE_OPTIONS,
  COLOR_MODES,
  DIALS,
  FOCUS_MINUTE_OPTIONS,
  IDLE_SECOND_OPTIONS,
  MATERIALS,
  SKINS,
  SOUNDS,
  type AtEnd,
  type ColorMode,
  type Dial as DialStyle,
  type Material,
  type Settings as SettingsValues,
  type Skin,
  type Sound,
} from '../../shared/settings.ts'
import { useT } from '../i18n.ts'
import { useSettings } from '../skin.ts'
import { Button } from '../ui/Button.tsx'
import { Dial } from '../ui/Dial.tsx'
import { Kbd } from '../ui/Kbd.tsx'
import { LanguageSelect } from '../ui/LanguageSelect.tsx'
import { Popup } from '../ui/Popup.tsx'
import { Chips, Row, Segmented, Switch } from './controls.tsx'

const { ody } = window

export const SETTINGS_SECTIONS = [
  { id: 'general', label: 'settings.general' },
  { id: 'focus', label: 'settings.focusBreaks' },
  { id: 'tracking', label: 'settings.tracking' },
  { id: 'appearance', label: 'settings.appearance' },
] as const

const SKIN_LABEL: Record<Skin, string> = {
  ambient: 'Ambient',
  fukasawa: 'Fukasawa',
  ataraxia: 'Ataraxia',
  graphite: 'Graphite',
}

const MODE_LABEL: Record<ColorMode, MessageKey> = {
  system: 'settings.modeSystem',
  light: 'settings.modeLight',
  dark: 'settings.modeDark',
}

const MATERIAL_LABEL: Record<Material, string> = {
  glass: 'Glass',
  solid: 'Solid',
}

const SOUND_LABEL: Record<Sound, string> = {
  none: '',
  glass: 'Glass',
  tink: 'Tink',
  pop: 'Pop',
}

const AT_END_LABEL: Record<AtEnd, MessageKey> = {
  overtime: 'settings.atEndOvertime',
  stop: 'settings.atEndStop',
}

const DIAL_HINT: Record<DialStyle, MessageKey> = {
  disc: 'settings.dialDiscHint',
  segment: 'settings.dialSegmentHint',
  movement: 'settings.dialMovementHint',
}

const DIAL_LABEL: Record<DialStyle, string> = {
  disc: 'Disc',
  segment: 'Segment',
  movement: 'Movement',
}

const patch = (changes: Partial<SettingsValues>) => {
  void ody.patchSettings(changes)
}

export function Settings() {
  const { t, duration } = useT()
  const settings = useSettings()
  const [health, setHealth] = useState<Health>({ state: 'recording' })
  const [notifications, setNotifications] = useState<NotifyStatus>('unavailable')

  useEffect(() => {
    ody.onHealth(setHealth)
    void ody.health().then(setHealth)
    void ody.notifyStatus().then(setNotifications)
  }, [])

  const minutes = (values: readonly number[]) =>
    values.map(value => ({
      value: String(value),
      label: t('unit.minutesPicker', { minutes: value }),
    }))

  const denied =
    health.reason === 'automation-denied' || settings.browserAuth === 'denied'
  const notifyGranted =
    notifications === 'authorized' || notifications === 'provisional'

  return (
    <div className="act-main set" data-tab="settings">
      <section className="set-section" id="set-general" data-section="general">
        <h2>{t('settings.general')}</h2>
        <div className="ui-card set-card">
          <Row
            name="language"
            label={t('settings.language')}
            hint={t('settings.languageHint')}
          >
            <LanguageSelect onChange={value => void ody.setLanguage(value)} />
          </Row>
          <Row
            name="launchAtLogin"
            label={t('settings.launchAtLogin')}
            hint={t('settings.launchAtLoginHint')}
          >
            <Switch
              name="launchAtLogin"
              label={t('settings.launchAtLogin')}
              on={settings.launchAtLogin}
              onChange={on => patch({ launchAtLogin: on })}
            />
          </Row>
          <Row
            name="menuBarTime"
            label={t('settings.menuBarTime')}
            hint={t('settings.menuBarTimeHint')}
          >
            <Switch
              name="menuBarTime"
              label={t('settings.menuBarTime')}
              on={settings.menuBarTime}
              onChange={on => patch({ menuBarTime: on })}
            />
          </Row>
          <Row
            name="focusShortcut"
            label={t('settings.focusShortcut')}
            hint={t('settings.focusShortcutHint')}
          >
            <Kbd>⌥ Space</Kbd>
          </Row>
        </div>
      </section>

      <section className="set-section" id="set-focus" data-section="focus">
        <h2>{t('settings.focusBreaks')}</h2>
        <p>{t('settings.focusBreaksHint')}</p>
        <div className="ui-card set-card">
          <Row
            name="focusMinutes"
            label={t('settings.defaultFocus')}
            hint={t('settings.defaultFocusHint')}
          >
            <Popup
              name="focusMinutes"
              label={t('settings.defaultFocus')}
              value={String(settings.focusMinutes)}
              options={minutes(FOCUS_MINUTE_OPTIONS)}
              onChange={value => patch({ focusMinutes: Number(value) })}
            />
          </Row>
          <Row
            name="breakMinutes"
            label={t('settings.defaultBreak')}
            hint={t('settings.defaultBreakHint')}
          >
            <Popup
              name="breakMinutes"
              label={t('settings.defaultBreak')}
              value={String(settings.breakMinutes)}
              options={minutes(BREAK_MINUTE_OPTIONS)}
              onChange={value => patch({ breakMinutes: Number(value) })}
            />
          </Row>
          <Row
            name="atEnd"
            label={t('settings.atEnd')}
            hint={t('settings.atEndHint')}
          >
            <Segmented
              name="atEnd"
              label={t('settings.atEnd')}
              value={settings.atEnd}
              options={AT_END.map(value => ({
                value,
                label: t(AT_END_LABEL[value]),
              }))}
              onChange={value => patch({ atEnd: value as AtEnd })}
            />
          </Row>
          <Row
            name="suggestBreak"
            label={t('settings.suggestBreak')}
            hint={t('settings.suggestBreakHint')}
          >
            <Switch
              name="suggestBreak"
              label={t('settings.suggestBreak')}
              on={settings.suggestBreak}
              onChange={on => patch({ suggestBreak: on })}
            />
          </Row>
          <Row
            name="sound"
            label={t('settings.sound')}
            hint={t('settings.soundHint')}
          >
            <Popup
              name="sound"
              label={t('settings.sound')}
              value={settings.sound}
              options={SOUNDS.map(value => ({
                value,
                label: SOUND_LABEL[value] || t('settings.soundNone'),
              }))}
              onChange={value => patch({ sound: value as Sound })}
            />
          </Row>
          <Row
            name="autoBreak"
            label={t('settings.autoBreak')}
            hint={t('settings.autoBreakHint')}
          >
            <Popup
              name="autoBreak"
              label={t('settings.autoBreak')}
              value={String(settings.autoBreakMinutes)}
              options={minutes(AUTO_BREAK_MINUTE_OPTIONS)}
              onChange={value => patch({ autoBreakMinutes: Number(value) })}
            />
          </Row>
        </div>
      </section>

      <section className="set-section" id="set-tracking" data-section="tracking">
        <h2>{t('settings.tracking')}</h2>
        <p>{t('settings.trackingHint')}</p>
        <div className="ui-card set-card">
          <Row
            name="status"
            label={t('settings.status')}
            below={
              <span className="set-health" data-health-row="">
                <span className="set-dot" data-tone="ok" />
                {t('settings.statusRecording')}
                {denied ? (
                  <>
                    <span className="set-dot" data-tone="warn" />
                    {t('settings.statusDomainNeeded')}
                  </>
                ) : null}
                <span
                  className="set-dot"
                  data-tone={notifyGranted ? 'ok' : 'no'}
                  data-notify={notifications}
                />
                <span data-notify-label="">
                  {t(
                    notifyGranted
                      ? 'settings.statusNotificationsOn'
                      : 'settings.statusNotificationsOff'
                  )}
                </span>
              </span>
            }
          >
            <Button
              variant="secondary"
              icon={ShieldCheck}
              data-open-privacy=""
              onClick={() => void ody.openPrivacy()}
            >
              {t('settings.openPrivacy')}
            </Button>
          </Row>
          <Row
            name="idleSeconds"
            label={t('settings.idleThreshold')}
            hint={t('settings.idleThresholdHint')}
          >
            <Segmented
              name="idleSeconds"
              label={t('settings.idleThreshold')}
              value={String(settings.idleSeconds)}
              options={IDLE_SECOND_OPTIONS.map(value => ({
                value: String(value),
                label: duration(value),
              }))}
              onChange={value => patch({ idleSeconds: Number(value) })}
            />
          </Row>
          <Row
            name="browserConsent"
            label={t('settings.browserDomains')}
            hint={t('settings.browserDomainsHint')}
          >
            <Switch
              name="browserConsent"
              label={t('settings.browserDomains')}
              on={settings.browserConsent}
              onChange={on => {
                if (on) {
                  void ody.requestBrowserAuth()
                } else {
                  patch({ browserConsent: false })
                }
              }}
            />
          </Row>
          <Row
            name="idleExempt"
            label={t('settings.idleExempt')}
            hint={t('settings.idleExemptHint')}
            below={
              <Chips
                name="idleExempt"
                label={t('settings.idleExempt')}
                values={settings.idleExempt}
                onChange={values => patch({ idleExempt: values })}
              />
            }
          />
          <Row
            name="excludedApps"
            label={t('settings.excludedApps')}
            hint={t('settings.excludedAppsHint')}
            below={
              <Chips
                name="excludedApps"
                label={t('settings.excludedApps')}
                values={settings.excludedApps}
                onChange={values => patch({ excludedApps: values })}
              />
            }
          />
        </div>
      </section>

      <section
        className="set-section"
        id="set-appearance"
        data-section="appearance"
      >
        <h2>{t('settings.appearance')}</h2>
        <p>{t('settings.appearanceHint')}</p>
        <div className="ui-card set-card">
          <Row name="theme" label={t('settings.theme')} />
          <div className="set-themes" data-themes="">
            {SKINS.map(skin => (
              <button
                type="button"
                key={skin}
                className="set-theme press"
                data-theme-card={skin}
                data-selected={settings.theme === skin}
                onClick={() => patch({ theme: skin })}
              >
                <span className="set-theme-preview" data-skin-card={skin}>
                  <span className="set-theme-side" />
                  <span className="set-theme-body">
                    <i data-line="title" />
                    <i data-line="mute" />
                    <i data-line="accent" />
                    <i data-line="mute" />
                  </span>
                </span>
                <span className="set-theme-name">
                  {SKIN_LABEL[skin]}
                  <span>
                    {skin === 'ambient' ? t('settings.themeDefault') : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <Row
            name="accent"
            label={t('settings.accent')}
            hint={t('settings.accentHint')}
          >
            <div className="set-accents" data-accents="">
              <button
                type="button"
                className="set-accent press"
                data-accent="default"
                data-selected={settings.accent === null}
                aria-label={t('settings.accentDefault')}
                title={t('settings.accentDefault')}
                onClick={() => patch({ accent: null })}
              />
              {ACCENT_OPTIONS.map(accent => (
                <button
                  type="button"
                  key={accent}
                  className="set-accent press"
                  data-accent={accent}
                  data-selected={settings.accent === accent}
                  aria-label={accent}
                  title={accent}
                  style={{ background: accent }}
                  onClick={() => patch({ accent })}
                />
              ))}
            </div>
          </Row>
          <Row
            name="mode"
            label={t('settings.mode')}
            hint={t('settings.modeHint')}
          >
            <Segmented
              name="mode"
              label={t('settings.mode')}
              value={settings.mode}
              options={COLOR_MODES.map(value => ({
                value,
                label: t(MODE_LABEL[value]),
              }))}
              onChange={value => patch({ mode: value as ColorMode })}
            />
          </Row>
          <Row
            name="material"
            label={t('settings.material')}
            hint={t('settings.materialHint')}
          >
            <Segmented
              name="material"
              label={t('settings.material')}
              value={settings.material}
              options={MATERIALS.map(value => ({
                value,
                label: MATERIAL_LABEL[value],
              }))}
              onChange={value => patch({ material: value as Material })}
            />
          </Row>
          <Row name="dial" label={t('settings.dial')} hint={t('settings.dialHint')} />
          <div className="set-dials" data-dials="">
            {DIALS.map(dial => (
              <button
                type="button"
                key={dial}
                className="set-dial press"
                data-dial-card={dial}
                data-selected={settings.dial === dial}
                onClick={() => patch({ dial })}
              >
                <Dial
                  dial={dial}
                  remaining={1500}
                  mode="focus"
                  label={DIAL_LABEL[dial]}
                  brand={t('app.name').toUpperCase()}
                  size={96}
                  numbers={false}
                />
                <b>{DIAL_LABEL[dial]}</b>
                <small>{t(DIAL_HINT[dial])}</small>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
