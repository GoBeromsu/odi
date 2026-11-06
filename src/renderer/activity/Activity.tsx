import { useEffect, useState } from 'react'
import { ChartGantt, Timer } from 'lucide-react'
import type { ActivityTab } from '../../shared/api.ts'
import { useT } from '../i18n.ts'
import { Sidebar } from '../ui/Sidebar.tsx'
import { SidebarItem } from '../ui/SidebarItem.tsx'
import { FocusTab } from './FocusTab.tsx'
import { TimeTab } from './TimeTab.tsx'
import { midnight, type Range } from './range.ts'
import './activity.css'

const { ody } = window

const TABS: readonly ActivityTab[] = ['focus', 'time', 'settings']

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
      </Sidebar>
      {tab === 'focus' ? (
        <FocusTab onStarted={() => setCollapsed(true)} />
      ) : (
        <TimeTab
          date={date}
          range={range}
          today={today}
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed(value => !value)}
          onPick={pick}
          onRange={setRange}
        />
      )}
    </div>
  )
}
