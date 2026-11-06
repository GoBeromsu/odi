;(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const h = (tag, text, ...kids) => {
    const e = document.createElement(tag)
    if (text != null) e.textContent = text
    e.append(...kids)
    return e
  }
  const svg = (tag, attrs = {}, ...kids) => {
    const e = document.createElementNS(SVG_NS, tag)
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
    e.append(...kids)
    return e
  }
  const mmss = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
  globalThis.OdyDom = { h, svg, mmss }
})()
