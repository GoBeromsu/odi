import type { ReactNode } from 'react'

export interface SidebarProps {
  collapsed?: boolean
  label: string
  children: ReactNode
}

export function Sidebar({ collapsed = false, label, children }: SidebarProps) {
  return (
    <aside
      className="ui-sidebar"
      aria-label={label}
      data-collapsed={collapsed}
      data-sidebar=""
    >
      {children}
    </aside>
  )
}

export function SidebarSpacer() {
  return <div className="ui-sidebar-spacer" />
}
