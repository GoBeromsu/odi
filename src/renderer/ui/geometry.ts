export const CENTER = 106
export const FULL_TURN = 3600

export const point = (
  radius: number,
  degrees: number,
  center = CENTER
): [number, number] => {
  const radians = ((degrees - 90) * Math.PI) / 180
  return [
    center + radius * Math.cos(radians),
    center + radius * Math.sin(radians),
  ]
}

export const turnDegrees = (remaining: number) =>
  (Math.max(0, remaining) / FULL_TURN) * 360

export function wedgePath(radius: number, degrees: number, center = CENTER) {
  if (degrees <= 0) {
    return ''
  }
  const span = Math.min(degrees, 359.99)
  const [x, y] = point(radius, span, center)
  const sweep = span > 180 ? 1 : 0
  return `M${center} ${center} L${center} ${center - radius} A${radius} ${radius} 0 ${sweep} 1 ${x} ${y} Z`
}

export function arcPath(
  radius: number,
  from: number,
  to: number,
  center = CENTER
) {
  const [x0, y0] = point(radius, from, center)
  const [x1, y1] = point(radius, to, center)
  const sweep = to - from > 180 ? 1 : 0
  return `M${x0} ${y0} A${radius} ${radius} 0 ${sweep} 1 ${x1} ${y1}`
}

export function minutesFromPointer(
  x: number,
  y: number,
  box: { left: number; top: number; width: number; height: number }
) {
  const dx = x - box.left - box.width / 2
  const dy = y - box.top - box.height / 2
  const raw = (Math.atan2(dx, -dy) * 180) / Math.PI
  const degrees = raw < 0 ? raw + 360 : raw
  return Math.min(60, Math.max(1, Math.round(degrees / 6)))
}
