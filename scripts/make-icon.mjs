import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const SIZE = 1024
const SS = 3
const CREAM = [0xf3, 0xee, 0xe8]
const TOMATO = [0xc9, 0x3a, 0x24]
const LEAF = [0x2f, 0x7a, 0x45]

const S = 1.95
const CX = 512
const CY = 540
const toIcon = (x, y) => [CX + (x - 160) * S, CY + (y - 160) * S]
const leafPoint = (x, y) => toIcon(160 + (x - 160) * 2.2, 15 + (y - 15) * 2.2)

const cubic = (p0, p1, p2, p3, n = 24) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const u = 1 - t
    return [0, 1].map(
      k =>
        u * u * u * p0[k] +
        3 * u * u * t * p1[k] +
        3 * u * t * t * p2[k] +
        t * t * t * p3[k]
    )
  })

const petal = sign => {
  const pt = (dx, dy) => leafPoint(160 + sign * dx, 15 + dy)
  const a = cubic(pt(0, 0), pt(-5, -9), pt(-16, -13), pt(-28, -9))
  const b = cubic(pt(-28, -9), pt(-23, 1), pt(-11, 5), pt(0, 0))
  return a.concat(b)
}
const petals = [petal(1), petal(-1)]

const inPoly = (poly, x, y) => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

const inRoundRect = (x, y) => {
  const lo = 100
  const hi = 924
  const r = 185
  if (x < lo || x > hi || y < lo || y > hi) {
    return false
  }
  const dx = Math.max(lo + r - x, x - (hi - r), 0)
  const dy = Math.max(lo + r - y, y - (hi - r), 0)
  return dx * dx + dy * dy <= r * r
}

const [rcx, rcy] = toIcon(160, 160)
const ringIn = (146 - 7) * S
const ringOut = (146 + 7) * S

const sample = (x, y) => {
  if (!inRoundRect(x, y)) {
    return null
  }
  if (petals.some(p => inPoly(p, x, y))) {
    return LEAF
  }
  const d = Math.hypot(x - rcx, y - rcy)
  return d >= ringIn && d <= ringOut ? TOMATO : CREAM
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let py = 0; py < SIZE; py++) {
  const row = py * (SIZE * 4 + 1)
  for (let px = 0; px < SIZE; px++) {
    let r = 0
    let g = 0
    let b = 0
    let hit = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const c = sample(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS)
        if (c) {
          r += c[0]
          g += c[1]
          b += c[2]
          hit++
        }
      }
    }
    const o = row + 1 + px * 4
    if (hit) {
      raw[o] = Math.round(r / hit)
      raw[o + 1] = Math.round(g / hit)
      raw[o + 2] = Math.round(b / hit)
      raw[o + 3] = Math.round((255 * hit) / (SS * SS))
    }
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return c >>> 0
})
const crc = buf => {
  let c = 0xffffffff
  for (const byte of buf) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc(body), body.length + 4)
  return out
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8
ihdr[9] = 6

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])
fs.writeFileSync(path.join(import.meta.dirname, '..', 'build', 'icon.png'), png)
