export const HUES = [
  '--a1',
  '--a2',
  '--a3',
  '--a4',
  '--a5',
  '--a6',
  '--a7',
  '--a8',
] as const

export function hashOf(key: string) {
  let value = 5381
  for (let i = 0; i < key.length; i++) {
    value = ((value * 33) ^ key.charCodeAt(i)) >>> 0
  }
  return value
}

export const hueOf = (key: string) => HUES[hashOf(key) % HUES.length]

export const hueVar = (key: string) => `var(${hueOf(key)})`
