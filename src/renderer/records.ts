import type { SessionDetail, SessionSummary } from '../shared/api.ts'
import type { Segment } from '../shared/session.ts'
import { h, mmss } from './dom.ts'

const { ody } = window
const KIND_NAME: Record<string, string> = {
  active: '활동',
  no_input: '입력 없음',
  away: '자리 비움',
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string | null,
  ...kids: (Node | string)[]
) => {
  const e = h(tag, text, ...kids)
  e.className = className
  return e
}
const clipped = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text: string
) => {
  const e = el(tag, `${className} rec-clip`, text)
  e.title = text
  return e
}
const dateTime = (sec: number) => new Date(sec * 1000).toLocaleString('ko-KR')
const time = (sec: number) => new Date(sec * 1000).toLocaleTimeString('ko-KR')
const seconds = (g: Segment) => g.ended_at - g.started_at
const segmentName = (g: Segment) =>
  [g.kind === 'active' ? null : KIND_NAME[g.kind], g.app_name, g.domain]
    .filter(Boolean)
    .join(' · ') || KIND_NAME[g.kind]

const stoppedMark = (s: { status: string }) =>
  s.status === 'ended' ? '' : ' · 중단됨'

const row = (s: SessionSummary, onSelect: (id: string) => void) => {
  const button = el(
    'button',
    'rec-row',
    null,
    clipped('span', 'rec-row-start', dateTime(s.started_at)),
    el('span', 'rec-row-meta', mmss(s.recorded_seconds) + stoppedMark(s))
  )
  button.type = 'button'
  button.dataset.id = s.id
  button.addEventListener('click', () => onSelect(s.id))
  return el('li', 'rec-list-item', null, button)
}

const stat = (label: string, value: number) =>
  el(
    'div',
    'rec-stat',
    null,
    el('dt', 'rec-stat-label', label),
    el('dd', 'rec-stat-value', mmss(value))
  )

const usage = (
  className: string,
  name: string,
  value: number,
  total: number
) => {
  const fill = el('span', 'rec-bar-fill')
  fill.style.width = `${(value / total) * 100}%`
  const bar = el('span', 'rec-bar', null, fill)
  bar.setAttribute('aria-hidden', 'true')
  return el(
    'div',
    `rec-usage ${className}`,
    null,
    clipped('span', 'rec-usage-name', name),
    el('span', 'rec-usage-time', mmss(value)),
    bar
  )
}

const appsSection = (apps: SessionDetail['totals']['apps'], total: number) => {
  const items = apps.map(a =>
    el(
      'li',
      'rec-app',
      null,
      usage('rec-usage-app', a.app ?? KIND_NAME.active, a.seconds, total),
      ...a.sites.map(site =>
        usage('rec-usage-site', site.domain, site.seconds, total)
      )
    )
  )
  return el(
    'section',
    'rec-group',
    null,
    el('h3', 'rec-group-title', '앱별 시간'),
    el('ul', 'rec-apps', null, ...items)
  )
}

const stripSegment = (g: Segment) => {
  const part = el('span', `rec-seg rec-seg-${g.kind}`)
  part.style.flexGrow = String(seconds(g))
  part.title = `${segmentName(g)} ${mmss(seconds(g))}`
  return part
}

const timelineSection = (d: SessionDetail) => {
  const active = d.segments
    .filter(g => g.kind === 'active')
    .reduce((sum, g) => sum + seconds(g), 0)
  const strip = el('div', 'rec-strip', null, ...d.segments.map(stripSegment))
  strip.setAttribute('role', 'img')
  strip.setAttribute(
    'aria-label',
    `타임라인. 활동 ${mmss(active)}, 입력 없음 ${mmss(d.totals.no_input)}, 자리 비움 ${mmss(d.totals.away)}, 구간 ${d.segments.length}개`
  )
  const legend = Object.entries(KIND_NAME).map(([kind, name]) =>
    el(
      'li',
      'rec-legend-item',
      null,
      el('span', `rec-seg rec-swatch rec-seg-${kind}`),
      h('span', name)
    )
  )
  const rows = d.segments.map(g =>
    el(
      'li',
      'rec-segment',
      null,
      el(
        'span',
        'rec-segment-range',
        `${time(g.started_at)} – ${time(g.ended_at)}`
      ),
      clipped('span', 'rec-segment-name', segmentName(g))
    )
  )
  return el(
    'section',
    'rec-group',
    null,
    el('h3', 'rec-group-title', '타임라인'),
    strip,
    el('ul', 'rec-legend', null, ...legend),
    el('ul', 'rec-segments', null, ...rows)
  )
}

const detailView = (d: SessionDetail) => {
  const recorded = d.segments.reduce((sum, g) => sum + seconds(g), 0)
  const sections = [
    el(
      'header',
      'rec-head',
      null,
      el('h2', 'rec-title', dateTime(d.started_at)),
      el(
        'p',
        'rec-plan',
        `계획 ${mmss(d.planned)} / 기록 ${mmss(recorded)}${stoppedMark(d)}`
      )
    ),
    el(
      'dl',
      'rec-stats',
      null,
      stat('기록 합계', recorded),
      stat('일시정지', d.paused_seconds),
      stat('입력 없음', d.totals.no_input),
      stat('자리 비움', d.totals.away)
    ),
  ]
  if (d.totals.apps.length) {
    sections.push(appsSection(d.totals.apps, recorded))
  }
  sections.push(timelineSection(d))
  return sections
}

let lastSelected: string | null = null

const render = (root: HTMLElement, selectedId: string | null) => {
  const view = el('div', 'rec')
  root.replaceChildren(view)
  ody.sessions().then(list => {
    if (!list.length) {
      view.replaceChildren(
        el(
          'p',
          'rec-empty',
          '아직 끝낸 세션이 없습니다. 타이머를 끝내면 여기에 남습니다.'
        )
      )
      return
    }
    const detail = el('div', 'rec-detail')
    let latest: Promise<SessionDetail | null> | undefined
    const select = (id: string) => {
      lastSelected = id
      const previous = rows.querySelector('[aria-current]')
      if (previous) {
        previous.removeAttribute('aria-current')
      }
      const next = rows.querySelector(`[data-id="${CSS.escape(id)}"]`)
      if (next) {
        next.setAttribute('aria-current', 'true')
        next.scrollIntoView({ block: 'nearest' })
      }
      const request = (latest = ody.session(id).catch(() => null))
      request.then(d => {
        if (request !== latest) {
          return
        }
        detail.replaceChildren(
          ...(d
            ? detailView(d)
            : [el('p', 'rec-failed', '이 기록을 읽을 수 없습니다.')])
        )
        detail.scrollTop = 0
      })
    }
    const rows = el('ul', 'rec-list', null, ...list.map(s => row(s, select)))
    rows.setAttribute('aria-label', '세션 목록')
    view.replaceChildren(rows, detail)
    const kept = list.some(s => s.id === lastSelected) && lastSelected
    select(selectedId ?? (kept || list[0].id))
  })
}

export { render }
