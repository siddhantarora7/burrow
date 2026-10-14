import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { HOOK_FILE, STATUS_FILE } from './config'
import { addHooks, addStatusLine, removeStatusLine, SettingsError, updateSettingsFile } from './settings'

/** Throws SettingsError if burrow could not merge into this settings file. Call before hatching. */
export async function checkSettings(settingsPath: string): Promise<void> {
  let raw: string
  try {
    raw = await readFile(settingsPath, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return
    throw e
  }
  if (raw.trim() === '') return
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new SettingsError(`${settingsPath} is not valid JSON. burrow left it untouched. Fix it, then run init again.`)
  }
  addHooks(parsed, HOOK_FILE) // throws SettingsError on shapes we cannot merge into
}

/** Copies the hook script and merges the hooks. Idempotent: returns the events it added. */
export async function installHooks(opts: { home: string; settingsPath: string; hookSource: string }): Promise<string[]> {
  await mkdir(opts.home, { recursive: true, mode: 0o700 })
  const script = join(opts.home, HOOK_FILE)
  await copyFile(opts.hookSource, script)
  let added: string[] = []
  await updateSettingsFile(opts.settingsPath, join(opts.home, 'backups'), (s) => {
    const r = addHooks(s, script)
    added = r.added
    return r.settings
  })
  return added
}

/** Copies the status-line script and makes it the status line. Returns the command it replaced, if any. */
export async function installStatusLine(opts: { home: string; settingsPath: string; source: string }): Promise<string | undefined> {
  await mkdir(opts.home, { recursive: true, mode: 0o700 })
  const script = join(opts.home, STATUS_FILE)
  await copyFile(opts.source, script)
  let then: string | undefined
  await updateSettingsFile(opts.settingsPath, join(opts.home, 'backups'), (s) => {
    const r = addStatusLine(s, `node "${script}"`)
    then = r.then
    return r.settings
  })
  return then
}

export async function uninstallStatusLine(opts: { home: string; settingsPath: string; then?: string }): Promise<void> {
  await updateSettingsFile(opts.settingsPath, join(opts.home, 'backups'), (s) => removeStatusLine(s, opts.then))
}
