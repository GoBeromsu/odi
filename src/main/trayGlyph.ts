export interface Rgb {
  r: number
  g: number
  b: number
}

export interface GlyphSpec {
  size: number
  scale: number
  degrees: number
  ink: Rgb
  badge: Rgb | null
}

export interface GlyphBitmap {
  data: Buffer
  width: number
  height: number
}

const SAMPLES = 3
const RING_WIDTH = 1.2
const RING_INSET = 1
const WEDGE_GAP = 1.6
const BADGE_RADIUS = 2.9

const clockwise = (dx: number, dy: number) => {
  const raw = (Math.atan2(dx, -dy) * 180) / Math.PI
  return raw < 0 ? raw + 360 : raw
}

export function glyphBitmap(spec: GlyphSpec): GlyphBitmap {
  const side = Math.round(spec.size * spec.scale)
  const center = side / 2
  const outer = center - RING_INSET * spec.scale
  const inner = outer - RING_WIDTH * spec.scale
  const wedge = outer - WEDGE_GAP * spec.scale
  const badgeR = BADGE_RADIUS * spec.scale
  const badgeX = side - badgeR
  const badgeY = side - badgeR
  const degrees = Math.max(0, Math.min(360, spec.degrees))
  const data = Buffer.alloc(side * side * 4)
  const step = 1 / (SAMPLES + 1)

  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      let ringHits = 0
      let wedgeHits = 0
      let badgeHits = 0
      for (let sy = 1; sy <= SAMPLES; sy++) {
        for (let sx = 1; sx <= SAMPLES; sx++) {
          const px = x + sx * step
          const py = y + sy * step
          const dx = px - center
          const dy = py - center
          const distance = Math.hypot(dx, dy)
          if (distance <= outer && distance >= inner) {
            ringHits++
          }
          if (
            distance <= wedge &&
            (degrees >= 360 || clockwise(dx, dy) <= degrees)
          ) {
            wedgeHits++
          }
          if (
            spec.badge &&
            Math.hypot(px - badgeX, py - badgeY) <= badgeR
          ) {
            badgeHits++
          }
        }
      }
      const total = SAMPLES * SAMPLES
      const inkAlpha = Math.min(1, (ringHits + wedgeHits) / total)
      const badgeAlpha = badgeHits / total
      const colour = badgeAlpha > 0.5 && spec.badge ? spec.badge : spec.ink
      const alpha = Math.max(inkAlpha, badgeAlpha)
      const offset = (y * side + x) * 4
      data[offset] = Math.round(colour.b * alpha)
      data[offset + 1] = Math.round(colour.g * alpha)
      data[offset + 2] = Math.round(colour.r * alpha)
      data[offset + 3] = Math.round(alpha * 255)
    }
  }

  return { data, width: side, height: side }
}

export function pixelAt(bitmap: GlyphBitmap, x: number, y: number) {
  const offset = (y * bitmap.width + x) * 4
  const alpha = bitmap.data[offset + 3] / 255
  const back = (value: number) => (alpha === 0 ? 0 : Math.round(value / alpha))
  return {
    r: back(bitmap.data[offset + 2]),
    g: back(bitmap.data[offset + 1]),
    b: back(bitmap.data[offset]),
    a: bitmap.data[offset + 3],
  }
}
