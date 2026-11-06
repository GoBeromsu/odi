import { ChevronsUpDown } from 'lucide-react'
import { Icon } from './Icon.tsx'

export interface PopupOption {
  value: string
  label: string
}

export interface PopupProps {
  label: string
  value: string
  options: PopupOption[]
  onChange: (value: string) => void
  name?: string
  compact?: boolean
}

export function Popup({
  label,
  value,
  options,
  onChange,
  name,
  compact = false,
}: PopupProps) {
  const chosen = options.find(o => o.value === value)
  return (
    <label className="ui-popup" data-compact={compact} data-popup={name ?? ''}>
      <span className="ui-popup-value tnum" data-popup-value="">
        {chosen ? chosen.label : value}
      </span>
      <Icon of={ChevronsUpDown} />
      <select
        aria-label={label}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
