import type { Mode, Phase } from './session.ts'

export type { Mode, Phase }

export interface View {
  phase: Phase
  mode: Mode
  planned: number
  remaining: number
  overtime?: number
}

export interface SessionRecord {
  id: string
  started_at: number
  ended_at: number | null
  planned: number
  paused_seconds: number
  overtime_seconds: number
  status: string
  kind: string
}

export interface OdyApi {
  state: () => Promise<View>
  onState: (cb: (v: View) => void) => void
  start: (mode: Mode, planned?: number) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>
  sessions: (from: number, to: number) => Promise<SessionRecord[]>
}
