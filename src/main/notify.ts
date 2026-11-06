import { execFile } from 'node:child_process'

export type NotifyStatus =
  | 'authorized'
  | 'denied'
  | 'notDetermined'
  | 'provisional'
  | 'unavailable'

export type NotifyCommand = 'status' | 'request'

const KNOWN: readonly NotifyStatus[] = [
  'authorized',
  'denied',
  'notDetermined',
  'provisional',
]

export function parseNotifyStatus(output: string): NotifyStatus {
  const line = output
    .trim()
    .split('\n')
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .pop()
  return KNOWN.find(status => status === line) ?? 'unavailable'
}

export const isNotifyGranted = (status: NotifyStatus) =>
  status === 'authorized' || status === 'provisional'

export function runNotifyHelper(binary: string, command: NotifyCommand) {
  return new Promise<NotifyStatus>(resolve =>
    execFile(
      binary,
      [command],
      { timeout: 30000, killSignal: 'SIGKILL' },
      (err, out) => {
        if (err) {
          console.error('notify helper:', err.message)
          resolve('unavailable')
          return
        }
        resolve(parseNotifyStatus(String(out)))
      }
    )
  )
}

export async function askNotifications(
  binary: string,
  run: (
    binary: string,
    command: NotifyCommand
  ) => Promise<NotifyStatus> = runNotifyHelper
) {
  const current = await run(binary, 'status')
  if (current === 'notDetermined') {
    return run(binary, 'request')
  }
  return current
}
