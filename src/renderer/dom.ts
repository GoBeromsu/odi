const SVG_NS = 'http://www.w3.org/2000/svg'

export const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string | null,
  ...kids: (Node | string)[]
) => {
  const e = document.createElement(tag)
  if (text !== undefined && text !== null) {
    e.textContent = text
  }
  e.append(...kids)
  return e
}

export const svg = (
  tag: string,
  attrs: Record<string, string | number> = {},
  ...kids: Element[]
) => {
  const e = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) {
    e.setAttribute(k, String(v))
  }
  e.append(...kids)
  return e
}

export { mmss } from '../shared/time.ts'
