import { useEffect, useState } from 'react'
import {
  ChartGantt,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Inbox,
  Pause,
  Play,
  PanelLeft,
  Settings,
  ShieldCheck,
  Square,
  Target,
  Timer,
} from 'lucide-react'
import {
  SKINS,
  MATERIALS,
  type Material,
  type Skin,
} from '../../shared/settings.ts'
import { useT } from '../i18n.ts'
import { Button } from './Button.tsx'
import { LanguageSelect } from './LanguageSelect.tsx'
import { Empty } from './Empty.tsx'
import { Icon } from './Icon.tsx'
import { IconButton } from './IconButton.tsx'
import { Kbd } from './Kbd.tsx'
import { Sidebar, SidebarSpacer } from './Sidebar.tsx'
import { SidebarItem } from './SidebarItem.tsx'
import { Stat } from './Stat.tsx'

const HUES = ['--a1', '--a2', '--a3', '--a4', '--a5', '--a6', '--a7', '--a8']
const THEMES = ['light', 'dark'] as const

type Theme = (typeof THEMES)[number]

export function Showcase() {
  const { t, locale, duration, date, relativeDay } = useT()
  const [skin, setSkin] = useState<Skin>('ambient')
  const [theme, setTheme] = useState<Theme>('light')
  const [material, setMaterial] = useState<Material>('glass')
  const [tab, setTab] = useState('focus')
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.skin = skin
    root.dataset.theme = theme
    root.dataset.material = material
  }, [skin, theme, material])

  return (
    <div className="showcase" data-showcase="">
      <Sidebar collapsed={collapsed} label="Showcase sections">
        <SidebarItem
          icon={Timer}
          label="Focus"
          selected={tab === 'focus'}
          onClick={() => setTab('focus')}
        />
        <SidebarItem
          icon={ChartGantt}
          label="Time Activity"
          selected={tab === 'time'}
          onClick={() => setTab('time')}
        />
        <SidebarSpacer />
        <SidebarItem
          icon={Settings}
          label="Settings"
          selected={tab === 'settings'}
          onClick={() => setTab('settings')}
        />
      </Sidebar>
      <main className="showcase-main">
        <header className="showcase-head">
          <IconButton
            icon={PanelLeft}
            label="Toggle sidebar"
            shortcut="Cmd+\\"
            data-toggle-sidebar=""
            onClick={() => setCollapsed(v => !v)}
          />
          <div>
            <h1>Primitives</h1>
            <p>
              {skin} · {theme} · {material}
            </p>
          </div>
          <div className="showcase-switches">
            {SKINS.map(value => (
              <Button
                key={value}
                variant={value === skin ? 'secondary' : 'ghost'}
                data-skin-choice={value}
                onClick={() => setSkin(value)}
              >
                {value}
              </Button>
            ))}
            {THEMES.map(value => (
              <Button
                key={value}
                variant={value === theme ? 'secondary' : 'ghost'}
                data-theme-choice={value}
                onClick={() => setTheme(value)}
              >
                {value}
              </Button>
            ))}
            {MATERIALS.map(value => (
              <Button
                key={value}
                variant={value === material ? 'secondary' : 'ghost'}
                data-material-choice={value}
                onClick={() => setMaterial(value)}
              >
                {value}
              </Button>
            ))}
          </div>
        </header>

        <section className="showcase-section" data-section="buttons">
          <h2>Button</h2>
          <div className="ui-card showcase-row">
            <Button
              variant="primary"
              icon={Play}
              shortcut="↵"
              data-primary=""
              data-press=""
            >
              Focus
            </Button>
            <Button variant="secondary" icon={Target}>
              Secondary
            </Button>
            <Button variant="ghost" icon={Coffee}>
              Ghost
            </Button>
            <Button variant="secondary" icon={ShieldCheck} disabled>
              Disabled
            </Button>
          </div>
        </section>

        <section className="showcase-section" data-section="icon-buttons">
          <h2>IconButton</h2>
          <div className="ui-card showcase-row">
            <IconButton icon={Play} label="Start focus" shortcut="↵" />
            <IconButton icon={Pause} label="Pause" shortcut="Space" />
            <IconButton icon={Square} label="Stop" shortcut="Esc" />
            <IconButton icon={ChevronLeft} label="Previous day" shortcut="←" />
            <IconButton icon={ChevronRight} label="Next day" shortcut="→" />
            <IconButton
              icon={Settings}
              label="Settings"
              size={20}
              tone="surface"
            />
            <IconButton icon={Square} label="Unavailable" disabled />
          </div>
        </section>

        <section className="showcase-section" data-section="icons">
          <h2>Icon</h2>
          <div className="ui-card showcase-row">
            <Icon of={Timer} />
            <Icon of={ChartGantt} />
            <Icon of={Target} size={20} />
            <Icon of={Coffee} size={20} />
          </div>
        </section>

        <section className="showcase-section" data-section="stats">
          <h2>Stat and Kbd</h2>
          <div className="ui-card showcase-row">
            <Stat label="Active" value="6h 12m" />
            <Stat label="Focus" value="3h 04m" tone="accent" />
            <Stat label="Switches" value="48" />
            <Kbd>⌥ Space</Kbd>
            <Kbd>T</Kbd>
            <Kbd>Cmd+\</Kbd>
          </div>
        </section>

        <section className="showcase-section" data-section="hues">
          <h2>App hues</h2>
          <div className="ui-card showcase-row">
            <div className="showcase-hues">
              {HUES.map(hue => (
                <span
                  key={hue}
                  className="showcase-hue"
                  data-hue={hue}
                  style={{ background: `var(${hue})` }}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="showcase-section" data-section="language">
          <h2>Language</h2>
          <div className="ui-card showcase-row">
            <LanguageSelect onChange={value => window.ody.setLanguage(value)} />
            <span data-lang-locale="">{locale}</span>
            <span data-lang-today="">{relativeDay(new Date())}</span>
            <span data-lang-label="">{t('activity.heroFocus')}</span>
            <span data-lang-date="">{date(new Date(), 'day')}</span>
            <span data-lang-duration="">{duration(3 * 3600 + 240)}</span>
          </div>
        </section>

        <section className="showcase-section" data-section="empty">
          <h2>Empty</h2>
          <div className="ui-card">
            <Empty
              icon={Inbox}
              message="No records for this day yet."
              action={
                <Button variant="secondary" icon={Timer}>
                  Go to today
                </Button>
              }
            />
          </div>
        </section>
      </main>
    </div>
  )
}
