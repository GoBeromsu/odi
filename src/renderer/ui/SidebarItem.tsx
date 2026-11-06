import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from './Icon.tsx'

export interface SidebarItemProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  icon: LucideIcon
  label: string
  selected?: boolean
}

export function SidebarItem({
  icon,
  label,
  selected = false,
  className,
  ...rest
}: SidebarItemProps) {
  const classes = ['ui-sidebar-item', 'press', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" className={classes} aria-current={selected} {...rest}>
      <Icon of={icon} />
      <span>{label}</span>
    </button>
  )
}
