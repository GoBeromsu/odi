import { useRef, type PointerEvent, type ReactElement } from 'react'
import type { Mode } from '../../shared/api.ts'
import type { Dial as DialStyle } from '../../shared/settings.ts'
import { clock } from '../../shared/time.ts'
import {
  arcPath,
  minutesFromPointer,
  point,
  turnDegrees,
  wedgePath,
} from './geometry.ts'

export interface DialProps {
  dial: DialStyle
  remaining: number
  mode: Mode
  label: string
  brand: string
  size: number
  wedge?: number
  numbers?: boolean
  onMinutes?: (minutes: number) => void
}

interface FaceProps {
  degrees: number
  remaining: number
  color: string
  wedge: number
  numbers: boolean
  brand: string
}

const TICKS = Array.from({ length: 60 }, (_, i) => i)
const FINE_TICKS = Array.from({ length: 240 }, (_, i) => i)
const FIVES = Array.from({ length: 12 }, (_, i) => i * 5)

const pad = (n: number) => String(n).padStart(2, '0')

function Disc({ degrees, color, wedge, numbers }: FaceProps) {
  return (
    <>
      {TICKS.map(i => {
        const [x1, y1] = point(i % 5 ? 92 : 88, i * 6)
        const [x2, y2] = point(97, i * 6)
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--tick)"
            strokeWidth={i % 5 ? 0.8 : 1.6}
            strokeLinecap="round"
            opacity={i % 5 ? 0.45 : 0.9}
          />
        )
      })}
      {numbers
        ? FIVES.map(minute => {
            const [x, y] = point(76, minute * 6)
            return (
              <text
                key={minute}
                x={x}
                y={y + 3.5}
                textAnchor="middle"
                fontSize={9.5}
                fill="var(--tick)"
                opacity={0.75}
              >
                {minute}
              </text>
            )
          })
        : null}
      <path
        className="ui-dial-wedge ui-dial-pulse"
        d={wedgePath(wedge, degrees)}
        fill={color}
      />
      <circle
        cx={106}
        cy={106}
        r={15}
        fill="var(--face)"
        stroke="var(--line)"
      />
      <circle cx={106} cy={106} r={11} fill="var(--body)" />
    </>
  )
}

function Segment({ remaining, color }: FaceProps) {
  const lit = Math.ceil(Math.max(0, remaining) / 60)
  return (
    <>
      {TICKS.map(i => (
        <path
          key={i}
          className="ui-dial-segment"
          d={arcPath(72, i * 6 + 0.9, i * 6 + 5.1)}
          stroke={i < lit ? color : 'var(--led-off)'}
          strokeWidth={14}
          fill="none"
        />
      ))}
      {FIVES.map(minute => {
        const [x, y] = point(94, minute * 6)
        return (
          <text
            key={minute}
            x={x}
            y={y + 3.5}
            textAnchor="middle"
            fontSize={9.5}
            fill="var(--led-mark)"
            opacity={0.85}
          >
            {minute}
          </text>
        )
      })}
      <text
        className="tnum"
        x={106}
        y={116}
        textAnchor="middle"
        fontSize={30}
        fontFamily="var(--mono)"
        fontWeight={300}
        fill="var(--led-ink)"
      >
        {clock(remaining)}
      </text>
    </>
  )
}

function Movement({ degrees, color, brand }: FaceProps) {
  return (
    <>
      {FINE_TICKS.map(i => {
        const major = i % 20 === 0
        const mid = i % 4 === 0
        const [x1, y1] = point(major ? 82 : mid ? 87 : 90, i * 1.5)
        const [x2, y2] = point(94, i * 1.5)
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--tick)"
            strokeWidth={major ? 1.6 : mid ? 0.8 : 0.4}
            opacity={major ? 0.95 : mid ? 0.6 : 0.35}
          />
        )
      })}
      {FIVES.map(minute => {
        const [x, y] = point(70, minute * 6)
        return (
          <text
            key={minute}
            x={x}
            y={y + 3.2}
            textAnchor="middle"
            fontSize={8.5}
            fontFamily="var(--mono)"
            fill="var(--tick)"
            opacity={0.8}
          >
            {pad(minute)}
          </text>
        )
      })}
      <text
        x={106}
        y={152}
        textAnchor="middle"
        fontSize={7}
        fontFamily="var(--mono)"
        fill="var(--tick)"
        opacity={0.45}
        letterSpacing={2}
      >
        {brand}
      </text>
      <path
        className="ui-dial-band ui-dial-pulse"
        d={degrees > 0.5 ? arcPath(99, 0, Math.min(359.5, degrees)) : ''}
        stroke={color}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      <g className="ui-dial-hand" transform={`rotate(${degrees} 106 106)`}>
        <line
          x1={106}
          y1={124}
          x2={106}
          y2={22}
          stroke="var(--tick)"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <circle cx={106} cy={106} r={4.5} fill="var(--tick)" />
      </g>
    </>
  )
}

const FACES: Record<DialStyle, (props: FaceProps) => ReactElement> = {
  disc: Disc,
  segment: Segment,
  movement: Movement,
}

export function Dial({
  dial,
  remaining,
  mode,
  label,
  brand,
  size,
  wedge = 64,
  numbers = true,
  onMinutes,
}: DialProps) {
  const svg = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const Face = FACES[dial]
  const scrub = onMinutes !== undefined && dial !== 'segment'

  const report = (e: PointerEvent<SVGSVGElement>) => {
    const node = svg.current
    if (!node || !onMinutes) {
      return
    }
    const box = node.getBoundingClientRect()
    onMinutes(minutesFromPointer(e.clientX, e.clientY, box))
  }

  return (
    <div
      className="ui-dial-device"
      data-dial-device=""
      style={{ width: size, height: size }}
    >
      <div className="ui-dial-face" data-led={dial === 'segment'}>
        <svg
          ref={svg}
          className="ui-dial"
          data-dial={dial}
          data-scrub={scrub}
          viewBox="0 0 212 212"
          role="img"
          aria-label={label}
          onPointerDown={
            scrub
              ? e => {
                  dragging.current = true
                  e.currentTarget.setPointerCapture(e.pointerId)
                  report(e)
                }
              : undefined
          }
          onPointerMove={
            scrub
              ? e => {
                  if (dragging.current) {
                    report(e)
                  }
                }
              : undefined
          }
          onPointerUp={
            scrub
              ? () => {
                  dragging.current = false
                }
              : undefined
          }
        >
          <Face
            degrees={turnDegrees(remaining)}
            remaining={remaining}
            color={mode === 'break' ? 'var(--a3)' : 'var(--acc)'}
            wedge={wedge}
            numbers={numbers}
            brand={brand}
          />
        </svg>
      </div>
    </div>
  )
}
