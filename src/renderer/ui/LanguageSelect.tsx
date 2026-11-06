import { ChevronsUpDown } from 'lucide-react'
import { LANGUAGES, type Language } from '../../shared/settings.ts'
import { useT } from '../i18n.ts'
import { Icon } from './Icon.tsx'

export interface LanguageSelectProps {
  onChange: (value: Language) => void
}

export function LanguageSelect({ onChange }: LanguageSelectProps) {
  const { t, setting, system } = useT()
  const resolved =
    system === 'ko'
      ? t('settings.languageKorean')
      : t('settings.languageEnglish')
  const label = (value: Language) =>
    value === 'system'
      ? t('settings.languageSystem', { resolved })
      : value === 'ko'
        ? t('settings.languageKorean')
        : t('settings.languageEnglish')

  return (
    <label className="ui-popup" data-language="">
      <span className="ui-popup-value" data-language-value="">
        {label(setting)}
      </span>
      <Icon of={ChevronsUpDown} />
      <select
        aria-label={t('settings.language')}
        value={setting}
        onChange={e => onChange(e.target.value as Language)}
      >
        {LANGUAGES.map(value => (
          <option key={value} value={value}>
            {label(value)}
          </option>
        ))}
      </select>
    </label>
  )
}
