import { copyFile, mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { HOOK_FILE, STATUS_FILE } from './config'
import type { HookArg } from './hook'

export class SettingsError extends Error {}

/** Claude Code hook event → the arg our script receives. Verified against code.claude.com/docs/en/hooks (2026-10-04). */
export const HOOKS: ReadonlyArray<readonly [string, HookArg]> = [
  ['SessionStart', 'session_start'],
  ['UserPromptSubmit', 'prompt'],
  ['PreToolUse', 'heartbeat'],
  ['PostToolBatch', 'heartbeat'],
  ['Notification', 'notify'],
  ['Stop', 'stop'],
  ['StopFailure', 'error'],
  ['SessionEnd', 'session_end'],
]

export function hookCommand(scriptPath: string, arg: HookArg): string {
  return `node "${scriptPath}" ${arg}`
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

export function isBurrowHook(h: unknown): boolean {
  return isObj(h) && typeof h.command === 'string' && h.command.includes(HOOK_FILE)
}

function hooksObject(settings: unknown): { root: Record<string, unknown>; hooks: Record<string, unknown> } {
  if (!isObj(settings)) throw new SettingsError('settings.json must contain a JSON object')
  const root = settings
  if (root.hooks === undefined) return { root, hooks: {} }
  if (!isObj(root.hooks)) throw new SettingsError('"hooks" in settings.json is not an object')
  for (const [k, v] of Object.entries(root.hooks)) {
    if (!Array.isArray(v)) throw new SettingsError(`"hooks.${k}" in settings.json is not a list`)
  }
  return { root, hooks: root.hooks }
}

export function addHooks(settings: unknown, scriptPath: string): { settings: Record<string, unknown>; added: string[] } {
  const { root, hooks } = hooksObject(settings)
  const added: string[] = []
  for (const [event, arg] of HOOKS) {
    const groups = (hooks[event] as unknown[] | undefined) ?? []
    const present = groups.some((g) => isObj(g) && Array.isArray(g.hooks) && g.hooks.some(isBurrowHook))
    if (present) continue
    groups.push({ hooks: [{ type: 'command', command: hookCommand(scriptPath, arg), async: true, timeout: 5 }] })
    hooks[event] = groups
    added.push(event)
  }
  return { settings: { ...root, hooks }, added }
}

const isBurrowStatus = (x: unknown) => isObj(x) && typeof x.command === 'string' && x.command.includes(STATUS_FILE)

/** Makes burrow's script the status line. A status line that was already there comes back as `then`, to run first. */
export function addStatusLine(settings: unknown, command: string): { settings: Record<string, unknown>; then?: string } {
  if (!isObj(settings)) throw new SettingsError('settings.json must contain a JSON object')
  const prev = settings.statusLine
  if (isBurrowStatus(prev)) return { settings }
  const then = isObj(prev) && typeof prev.command === 'string' ? prev.command : undefined
  return { settings: { ...settings, statusLine: { type: 'command', command, refreshInterval: 30 } }, ...(then ? { then } : {}) }
}

/** Puts back the status line burrow replaced, or removes burrow's. Anyone else's status line is left alone. */
export function removeStatusLine(settings: unknown, then?: string): Record<string, unknown> {
  if (!isObj(settings)) throw new SettingsError('settings.json must contain a JSON object')
  if (!isBurrowStatus(settings.statusLine)) return settings
  const { statusLine: _ours, ...rest } = settings
  return then ? { ...rest, statusLine: { type: 'command', command: then } } : rest
}

export function removeHooks(settings: unknown): { settings: Record<string, unknown>; removed: number } {
  const { root, hooks } = hooksObject(settings)
  const hadEvents = Object.keys(hooks).length > 0
  let removed = 0
  for (const [event, value] of Object.entries(hooks)) {
    const before = value as unknown[]
    let touched = false
    const groups = before.flatMap((g) => {
      if (!isObj(g) || !Array.isArray(g.hooks)) return [g]
      const kept = g.hooks.filter((h) => !isBurrowHook(h))
      if (kept.length === g.hooks.length) return [g]
      touched = true
      removed += g.hooks.length - kept.length
      return kept.length ? [{ ...g, hooks: kept }] : []
    })
    // Only remove containers that burrow itself emptied; the user's own empties stay.
    if (touched && groups.length === 0) delete hooks[event]
    else if (touched) hooks[event] = groups
  }
  const out: Record<string, unknown> = { ...root, hooks }
  if (removed > 0 && hadEvents && Object.keys(hooks).length === 0) delete out.hooks
  return { settings: out, removed }
}

/** Keep the file's own indentation and trailing newline so a round trip changes nothing else. */
function formatLike(raw: string | null, value: unknown): string {
  const detected = raw?.match(/^\{\r?\n([ \t]+)"/)?.[1]
  // A minified or new file is being reformatted anyway; give it the conventional trailing newline.
  const newline = detected === undefined || raw === null || raw.endsWith('\n')
  const indent = detected ?? 2
  return JSON.stringify(value, null, indent) + (newline ? '\n' : '')
}

export async function updateSettingsFile(
  path: string,
  backupDir: string,
  fn: (s: unknown) => Record<string, unknown>,
): Promise<{ backup: string | null }> {
  // Write through symlinks (dotfile managers) instead of replacing the link with a file.
  path = await realpath(path).catch(() => path)
  let raw: string | null = null
  try {
    raw = await readFile(path, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
  let current: unknown = {}
  if (raw !== null && raw.trim() !== '') {
    try {
      current = JSON.parse(raw)
    } catch {
      throw new SettingsError(`${path} is not valid JSON. burrow left it untouched. Fix it, then run init again.`)
    }
  }
  const next = fn(current)
  let backup: string | null = null
  if (raw !== null) {
    await mkdir(backupDir, { recursive: true })
    backup = join(backupDir, `settings.backup.${Date.now()}.json`)
    await copyFile(path, backup)
  }
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.burrow.tmp`
  await writeFile(tmp, formatLike(raw, next))
  await rename(tmp, path)
  return { backup }
}
