import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icon, type IconSize } from './Icon.tsx'

type Bare = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'title' | 'children'
>

export interface IconButtonProps extends Bare {
  icon: LucideIcon
  label: string
  shortcut?: string
  size?: IconSize
  tone?: 'ghost' | 'surface'
}

export function IconButton({
  icon,
  label,
  shortcut,
  size = 16,
  tone = 'ghost',
  className,
  ...rest
}: IconButtonProps) {
  const classes = ['ui-icon-button', 'press', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type="button"
      className={classes}
      data-size={size}
      data-tone={tone}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      {...rest}
    >
      <Icon of={icon} size={size} />
    </button>
  )
}
