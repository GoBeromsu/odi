import type { Mode } from '../../shared/api.ts'
import { turnDegrees, wedgePath } from './geometry.ts'

export interface GlyphProps {
  remaining: number
  mode: Mode
  size?: number
}

export function Glyph({ remaining, mode, size = 20 }: GlyphProps) {
  const center = size / 2
  return (
    <svg
      className="ui-glyph"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx={center}
        cy={center}
        r={center - 1}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
      />
      <path
        d={wedgePath(center - 2.6, turnDegrees(remaining), center)}
        fill={mode === 'break' ? 'var(--a3)' : 'var(--acc)'}
      />
    </svg>
  )
}
