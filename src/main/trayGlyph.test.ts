import { describe, expect, it } from 'vitest'
import { glyphBitmap, pixelAt } from './trayGlyph.ts'

const INK = { r: 20, g: 20, b: 20 }
const AMBER = { r: 255, g: 179, b: 71 }

const spec = (degrees: number, badge: typeof AMBER | null) => ({
  size: 18,
  scale: 2,
  degrees,
  ink: INK,
  badge,
})

describe('glyphBitmap', () => {
  it('sizes the bitmap by size times scale', () => {
    const glyph = glyphBitmap(spec(0, null))
    expect(glyph.width).toBe(36)
    expect(glyph.height).toBe(36)
    expect(glyph.data.length).toBe(36 * 36 * 4)
  })

  it('leaves the middle clear while idle and fills it at a full turn', () => {
    const empty = glyphBitmap(spec(0, null))
    const full = glyphBitmap(spec(360, null))
    expect(pixelAt(empty, 18, 18).a).toBe(0)
    expect(pixelAt(full, 18, 18).a).toBe(255)
    expect(pixelAt(full, 18, 18)).toMatchObject(INK)
  })

  it('draws the ring in ink on every state', () => {
    const glyph = glyphBitmap(spec(0, null))
    const ring = pixelAt(glyph, 18, 3)
    expect(ring.a).toBeGreaterThan(0)
    expect(ring.r).toBe(INK.r)
  })

  it('fills only the first half of the face at 180 degrees', () => {
    const glyph = glyphBitmap(spec(180, null))
    expect(pixelAt(glyph, 24, 12).a).toBe(255)
    expect(pixelAt(glyph, 12, 12).a).toBe(0)
  })

  it('paints the badge in its own colour and omits it when healthy', () => {
    const faulty = glyphBitmap(spec(90, AMBER))
    const healthy = glyphBitmap(spec(90, null))
    expect(pixelAt(faulty, 32, 32)).toMatchObject(AMBER)
    expect(pixelAt(faulty, 32, 32).a).toBe(255)
    expect(pixelAt(healthy, 32, 32).a).toBe(0)
  })
})
