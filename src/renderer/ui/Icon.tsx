import type { LucideIcon } from 'lucide-react'

export type IconSize = 16 | 20

export interface IconProps {
  of: LucideIcon
  size?: IconSize
  className?: string
}

export function Icon({ of: Glyph, size = 16, className }: IconProps) {
  return (
    <Glyph
      size={size}
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
      focusable="false"
    />
  )
}
