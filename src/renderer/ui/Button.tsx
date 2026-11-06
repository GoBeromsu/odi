import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from './Icon.tsx'
import { Kbd } from './Kbd.tsx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: LucideIcon
  shortcut?: string
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  icon,
  shortcut,
  children,
  className,
  ...rest
}: ButtonProps) {
  const classes = ['ui-button', `ui-button-${variant}`, 'press', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" className={classes} data-variant={variant} {...rest}>
      {icon ? <Icon of={icon} /> : null}
      <span>{children}</span>
      {shortcut ? <Kbd>{shortcut}</Kbd> : null}
    </button>
  )
}
