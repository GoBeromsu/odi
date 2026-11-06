import { useState, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { useT } from '../i18n.ts'
import { Icon } from '../ui/Icon.tsx'
import { IconButton } from '../ui/IconButton.tsx'

export interface RowProps {
  name: string
  label: string
  hint?: string
  children?: ReactNode
  below?: ReactNode
}

export function Row({ name, label, hint, children, below }: RowProps) {
  return (
    <div className="set-row" data-row={name}>
      <div className="set-label">
        <b>{label}</b>
        {hint ? <small>{hint}</small> : null}
        {below}
      </div>
      {children}
    </div>
  )
}

export interface SwitchProps {
  name: string
  label: string
  on: boolean
  onChange: (on: boolean) => void
}

export function Switch({ name, label, on, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      className="set-switch press"
      data-switch={name}
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={() => onChange(!on)}
    />
  )
}

export interface SegmentedOption {
  value: string
  label: string
}

export interface SegmentedProps {
  name: string
  label: string
  value: string
  options: SegmentedOption[]
  onChange: (value: string) => void
}

export function Segmented({
  name,
  label,
  value,
  options,
  onChange,
}: SegmentedProps) {
  return (
    <div
      className="act-segment"
      role="group"
      aria-label={label}
      data-segmented={name}
    >
      {options.map(option => (
        <button
          type="button"
          key={option.value}
          className="press"
          data-option={option.value}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export interface ChipsProps {
  name: string
  label: string
  values: string[]
  onChange: (values: string[]) => void
}

export function Chips({ name, label, values, onChange }: ChipsProps) {
  const { t } = useT()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const commit = () => {
    const entry = draft.trim()
    if (entry.length > 0 && !values.includes(entry)) {
      onChange([...values, entry])
    }
    setDraft('')
    setAdding(false)
  }

  return (
    <div className="set-chips" data-chips={name}>
      {values.map(value => (
        <span className="set-chip" key={value} data-chip={value}>
          {value}
          <IconButton
            icon={X}
            label={`${t('settings.remove')} ${value}`}
            data-chip-remove={value}
            onClick={() => onChange(values.filter(v => v !== value))}
          />
        </span>
      ))}
      {adding ? (
        <input
          className="set-chip-input"
          data-chip-input={name}
          aria-label={label}
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              commit()
            }
            if (e.key === 'Escape') {
              setDraft('')
              setAdding(false)
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="set-chip-add press"
          data-chip-add={name}
          onClick={() => setAdding(true)}
        >
          <Icon of={Plus} />
          {t('settings.add')}
        </button>
      )}
    </div>
  )
}
