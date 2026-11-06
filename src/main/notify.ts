import { execFile } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

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

function runHelper(binary: string, args: string[]) {
  const bundled = binary.endsWith('.app')
  const dir = bundled ? mkdtempSync(path.join(tmpdir(), 'ody-notify-')) : ''
  const out = path.join(dir, 'out.txt')
  const [cmd, argv] = bundled
    ? ['open', ['-W', '-g', '-n', '--stdout', out, binary, '--args', ...args]]
    : [binary, args]
  return new Promise<string | null>(resolve =>
    execFile(
      cmd,
      argv,
      { timeout: 70000, killSignal: 'SIGKILL' },
      (err, stdout) => {
        let text = String(stdout)
        if (bundled) {
          try {
            text = readFileSync(out, 'utf8')
          } catch {
            text = ''
          }
          rmSync(dir, { recursive: true, force: true })
        }
        if (err) {
          console.error('notify helper:', err.message)
          resolve(null)
          return
        }
        resolve(text)
      }
    )
  )
}

export async function runNotifyHelper(binary: string, command: NotifyCommand) {
  const text = await runHelper(binary, [command])
  return text === null ? 'unavailable' : parseNotifyStatus(text)
}

export async function postNotification(
  binary: string,
  title: string,
  body: string,
  silent: boolean
) {
  const text = await runHelper(binary, [
    'post',
    title,
    body,
    silent ? 'silent' : 'sound',
  ])
  return text?.trim() === 'posted'
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
