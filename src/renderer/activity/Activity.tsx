import { useEffect, useState } from 'react'
import {
  Activity as ActivityIcon,
  ChartGantt,
  Palette,
  Settings as SettingsIcon,
  Settings2,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import type { ActivityTab } from '../../shared/api.ts'
import { useT } from '../i18n.ts'
import { Sidebar, SidebarSpacer } from '../ui/Sidebar.tsx'
import { SidebarItem } from '../ui/SidebarItem.tsx'
import { FocusTab } from './FocusTab.tsx'
import { Settings, SETTINGS_SECTIONS } from './Settings.tsx'
import { TimeTab } from './TimeTab.tsx'
import { midnight, type Range } from './range.ts'
import './activity.css'

const { ody } = window

const TABS: readonly ActivityTab[] = ['focus', 'time', 'settings']

const SECTION_ICON: Record<string, LucideIcon> = {
  general: Settings2,
  focus: Timer,
  tracking: ActivityIcon,
  appearance: Palette,
}

const openingTab = (): ActivityTab => {
  const asked = new URLSearchParams(window.location.search).get('tab')
  return TABS.includes(asked as ActivityTab) ? (asked as ActivityTab) : 'focus'
}

export function Activity() {
  const { t } = useT()
  const [tab, setTab] = useState<ActivityTab>(openingTab)
  const [collapsed, setCollapsed] = useState(false)
  const [date, setDate] = useState(() => midnight(new Date()))
  const [range, setRange] = useState<Range>('day')
  const [section, setSection] = useState<string>(SETTINGS_SECTIONS[0].id)
  const today = midnight(new Date())

  useEffect(() => {
    ody.onActivityTab(setTab)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === '\\') {
        e.preventDefault()
        setCollapsed(value => !value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pick = (next: Date, nextRange: Range) => {
    setDate(midnight(next))
    setRange(nextRange)
  }

  return (
    <div
      className="act"
      data-activity=""
      data-tab={tab}
      data-collapsed={collapsed}
    >
      <Sidebar collapsed={collapsed} label={t('activity.title')}>
        <SidebarItem
          icon={Timer}
          label={t('activity.tabFocus')}
          selected={tab === 'focus'}
          data-tab-choice="focus"
          onClick={() => setTab('focus')}
        />
        <SidebarItem
          icon={ChartGantt}
          label={t('activity.tabTime')}
          selected={tab === 'time'}
          data-tab-choice="time"
          onClick={() => setTab('time')}
        />
        <SidebarSpacer />
        <SidebarItem
          icon={SettingsIcon}
          label={t('activity.settings')}
          selected={tab === 'settings'}
          data-tab-choice="settings"
          onClick={() => {
            setTab('settings')
            setSection(SETTINGS_SECTIONS[0].id)
          }}
        />
        {tab === 'settings'
          ? SETTINGS_SECTIONS.map(entry => (
              <SidebarItem
                key={entry.id}
                className="act-subitem"
                icon={SECTION_ICON[entry.id]}
                label={t(entry.label)}
                selected={section === entry.id}
                data-section-link={entry.id}
                onClick={() => {
                  setSection(entry.id)
                  document
                    .getElementById(`set-${entry.id}`)
                    ?.scrollIntoView({ block: 'start' })
                }}
              />
            ))
          : null}
      </Sidebar>
      {tab === 'settings' ? <Settings /> : null}
      {tab === 'focus' ? (
        <FocusTab onStarted={() => setCollapsed(true)} />
      ) : null}
      {tab === 'time' ? (
        <TimeTab
          date={date}
          range={range}
          today={today}
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed(value => !value)}
          onPick={pick}
          onRange={setRange}
        />
      ) : null}
    </div>
  )
}
