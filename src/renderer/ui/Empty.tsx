import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from './Icon.tsx'

export interface EmptyProps {
  icon: LucideIcon
  message: string
  action?: ReactNode
}

export function Empty({ icon, message, action }: EmptyProps) {
  return (
    <div className="ui-empty" data-empty="">
      <Icon of={icon} size={20} />
      <p>{message}</p>
      {action}
    </div>
  )
}
