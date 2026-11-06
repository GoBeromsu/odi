import fs from 'node:fs'
import path from 'node:path'
import { coerceSettings, type Settings } from '../shared/settings.ts'

export function writeJsonAtomic(target: string, data: unknown) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target + '.tmp', JSON.stringify(data, null, 2))
  fs.renameSync(target + '.tmp', target)
}

export function openSettings(file: string) {
  const load = () => {
    try {
      return coerceSettings(JSON.parse(fs.readFileSync(file, 'utf8')))
    } catch {
      return coerceSettings({})
    }
  }
  let current = load()
  return {
    file,
    get: () => current,
    reload: () => {
      current = load()
      return current
    },
    patch: (changes: Partial<Settings>) => {
      current = coerceSettings({ ...current, ...changes })
      writeJsonAtomic(file, current)
      return current
    },
  }
}

export type SettingsStore = ReturnType<typeof openSettings>
