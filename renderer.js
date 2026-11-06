;(() => {
  const { h, svg, mmss } = OdyDom
  const { ody } = window

  const ICONS = {
    timer: [
      'M12 7.5c-4.4 0-8 2.9-8 6.8S7.6 21 12 21s8-2.8 8-6.7-3.6-6.8-8-6.8Z',
      'M8.5 4.5 12 7.5l3.5-3',
      'M12 7.5V3',
    ],
    records: [
      'M9 6h11',
      'M9 12h11',
      'M9 18h11',
      'M4.5 6h.01',
      'M4.5 12h.01',
      'M4.5 18h.01',
    ],
    settings: [
      'M4 7h8',
      'M18 7h2',
      'M15 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z',
      'M4 17h2',
      'M12 17h8',
      'M9 14.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z',
    ],
    play: ['M7.5 4.5v15L20 12Z'],
    pause: ['M6.5 5H10v14H6.5Z', 'M14 5h3.5v14H14Z'],
    stop: ['M6 6h12v12H6Z'],
  }

  const PRIMARY = {
    idle: { label: '시작', icon: 'play', act: ody.start },
    running: { label: '일시정지', icon: 'pause', act: ody.pause },
    paused: { label: '재개', icon: 'play', act: ody.resume },
  }

  const THEMES = [
    ['system', '시스템'],
    ['light', '라이트'],
    ['dark', '다크'],
  ]

  const icon = name =>
    svg(
      'svg',
      { class: 'icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
      ...ICONS[name].map(d => svg('path', { d }))
    )

  const name = (el, label) => {
    el.setAttribute('aria-label', label)
    el.title = label
  }

  const iconButton = (className, label, iconName, onClick) => {
    const b = h('button', null, icon(iconName))
    b.type = 'button'
    b.className = className
    name(b, label)
    b.addEventListener('click', onClick)
    return b
  }

  const shell = document.getElementById('shell')
  const rail = document.getElementById('rail')
  const view = document.getElementById('view')

  let route = null
  let phase = 'idle'

  const primary = iconButton('icon-button primary', '시작', 'play', () =>
    PRIMARY[phase].act()
  )
  const stop = iconButton('icon-button', '중단', 'stop', () => ody.stop())
  stop.hidden = true

  const ringValue = svg('circle', {
    class: 'ring-value',
    cx: 160,
    cy: 160,
    r: 146,
    pathLength: 1,
    transform: 'rotate(-90 160 160)',
  })
  const minutes = h('span')
  const seconds = h('span')
  const colon = h('span', ':')
  colon.className = 'colon'
  const digits = h('div', null, minutes, colon, seconds)
  digits.className = 'digits'
  const ring = h(
    'div',
    null,
    svg(
      'svg',
      { class: 'ring-art', viewBox: '0 0 320 320', 'aria-hidden': 'true' },
      svg('circle', { class: 'ring-track', cx: 160, cy: 160, r: 146 }),
      ringValue,
      svg('path', {
        class: 'ring-leaf',
        d: 'M160 15c-5-9-16-13-28-9 5 10 17 14 28 9Zm0 0c5-9 16-13 28-9-5 10-17 14-28 9Z',
      })
    ),
    digits
  )
  ring.className = 'ring'
  ring.setAttribute('role', 'timer')
  const controls = h('div', null, primary, stop)
  controls.className = 'controls'
  const timerEl = h('div', null, ring, controls)
  timerEl.className = 'timer'

  const settingsTitle = h('h1', '설정')
  settingsTitle.className = 'page-title'
  const themeLabel = h('span', '화면 모드')
  themeLabel.id = 'theme-label'
  const themeInputs = THEMES.map(([value]) => {
    const input = h('input')
    input.type = 'radio'
    input.name = 'theme'
    input.value = value
    input.addEventListener('change', () => ody.setTheme(value))
    return input
  })
  const segmented = h(
    'div',
    null,
    ...themeInputs.map((input, i) =>
      h('label', null, input, h('span', THEMES[i][1]))
    )
  )
  segmented.className = 'segmented'
  segmented.setAttribute('role', 'radiogroup')
  segmented.setAttribute('aria-labelledby', themeLabel.id)
  const settingsCard = h('div', null, themeLabel, segmented)
  settingsCard.className = 'card setting-row'
  const settingsEl = h('div', null, settingsTitle, settingsCard)
  settingsEl.className = 'settings'

  const syncRail = () => {
    shell.toggleAttribute(
      'data-receded',
      phase === 'running' && route === 'timer'
    )
  }

  const show = (next, id = null) => {
    route = next
    for (const b of rail.querySelectorAll('button')) {
      if (b.dataset.route === next) b.setAttribute('aria-current', 'page')
      else b.removeAttribute('aria-current')
    }
    if (next === 'timer') view.replaceChildren(timerEl)
    if (next === 'settings') view.replaceChildren(settingsEl)
    if (next === 'records') OdyRecords.render(view, id)
    syncRail()
  }

  const railItems = [
    ['timer', '타이머'],
    ['records', '기록'],
    ['settings', '설정'],
  ].map(([id, label]) => {
    const b = iconButton('rail-item', label, id, () => {
      if (route !== id) show(id)
      if (id === 'timer') primary.focus()
    })
    b.dataset.route = id
    return b
  })
  rail.setAttribute('aria-label', '탭')
  rail.append(...railItems)

  const renderState = s => {
    const remaining = s.remaining ?? s.planned
    const frac = remaining / s.planned
    const [m, sec] = mmss(remaining).split(':')
    const stopHadFocus = document.activeElement === stop

    phase = s.phase
    timerEl.dataset.phase = phase
    ringValue.setAttribute('stroke-dasharray', `${frac} 1`)
    ringValue.setAttribute('stroke-dashoffset', -(1 - frac))
    minutes.textContent = m
    seconds.textContent = sec
    ring.setAttribute('aria-label', `남은 시간 ${m}분 ${Number(sec)}초`)

    const { label, icon: iconName } = PRIMARY[phase]
    name(primary, label)
    primary.replaceChildren(icon(iconName))
    stop.hidden = phase !== 'paused'
    if (stopHadFocus && stop.hidden) primary.focus()
    syncRail()
  }

  document.addEventListener('keydown', e => {
    if (e.code !== 'Space' || e.repeat || route !== 'timer') return
    if (e.target.closest('button, input')) return
    e.preventDefault()
    PRIMARY[phase].act()
  })

  ody.onState(renderState)
  ody.onEnded(id => {
    show('records', id)
    rail.querySelector('[data-route="records"]').focus()
  })
  ody.theme().then(theme => {
    themeInputs.find(input => input.value === theme).checked = true
  })
  ody.state().then(s => {
    renderState(s)
    show('timer')
  })
})()
