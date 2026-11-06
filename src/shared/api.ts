import type { Segment, Totals } from './session.ts'

export type Theme = 'system' | 'light' | 'dark'
export type Phase = 'idle' | 'running' | 'paused'

export interface View {
  phase: Phase
  planned: number
  remaining?: number
}

export interface SessionSummary {
  id: string
  started_at: number
  ended_at: number
  recorded_seconds: number
  paused_seconds: number
  status: string
}

export interface SessionDetail {
  id: string
  planned: number
  paused_seconds: number
  started_at: number
  ended_at: number
  segments: Segment[]
  totals: Totals
  status: string
}

export interface OdyApi {
  state: () => Promise<View>
  onState: (cb: (v: View) => void) => void
  start: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>
  sessions: () => Promise<SessionSummary[]>
  session: (id: string) => Promise<SessionDetail | null>
  onEnded: (cb: (id: string) => void) => void
  theme: () => Promise<Theme>
  setTheme: (v: Theme) => Promise<void>
}
