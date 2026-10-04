import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addHooks, HOOKS, hookCommand, removeHooks, SettingsError, updateSettingsFile } from '../src/settings'

const SCRIPT = '/Users/me/.burrow/burrow-hook.mjs'
const userSettings = {
  model: 'opus',
  hooks: {
    Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }],
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: './guard.sh' }] }],
  },
  permissions: { allow: ['Bash(npm test)'] },
}

describe('addHooks', () => {
  it('adds one async command hook per event and keeps everything else', () => {
    const { settings, added } = addHooks(structuredClone(userSettings), SCRIPT)
    expect(added).toEqual(HOOKS.map(([e]) => e))
    const hooks = settings.hooks as Record<string, Array<{ hooks: Array<Record<string, unknown>> }>>
    expect(hooks.Stop).toHaveLength(2)
    expect(hooks.Stop![0]).toEqual(userSettings.hooks.Stop[0])
    expect(hooks.Stop![1]!.hooks[0]).toEqual({ type: 'command', command: hookCommand(SCRIPT, 'stop'), async: true, timeout: 5 })
    expect(hooks.PreToolUse).toEqual(userSettings.hooks.PreToolUse)
    expect(settings.model).toBe('opus')
    expect(settings.permissions).toEqual(userSettings.permissions)
  })
  it('is idempotent', () => {
    const once = addHooks(structuredClone(userSettings), SCRIPT).settings
    const twice = addHooks(structuredClone(once), SCRIPT)
    expect(twice.added).toEqual([])
    expect(twice.settings).toEqual(once)
  })
  it('works on empty settings', () => {
    expect(addHooks({}, SCRIPT).added).toHaveLength(HOOKS.length)
  })
  it('never uses the http hook type', () => {
    expect(JSON.stringify(addHooks({}, SCRIPT).settings)).not.toContain('"http"')
  })
  it.each([[[]], ['str'], [{ hooks: [] }], [{ hooks: { Stop: {} } }]])('refuses odd shapes %j', (s) => {
    expect(() => addHooks(s, SCRIPT)).toThrow(SettingsError)
  })
})

describe('removeHooks', () => {
  it('restores the original settings exactly', () => {
    const withHooks = addHooks(structuredClone(userSettings), SCRIPT).settings
    const { settings, removed } = removeHooks(withHooks)
    expect(removed).toBe(HOOKS.length)
    expect(settings).toEqual(userSettings)
  })
  it('drops the hooks key when burrow was the only user of it', () => {
    const { settings } = removeHooks(addHooks({ model: 'x' }, SCRIPT).settings)
    expect(settings).toEqual({ model: 'x' })
  })
})

describe('updateSettingsFile', () => {
  it('backs up, then writes 2-space JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'burrow-set-'))
    const file = join(dir, 'settings.json')
    await writeFile(file, JSON.stringify(userSettings))
    const { backup } = await updateSettingsFile(file, join(dir, 'backups'), (s) => addHooks(s, SCRIPT).settings)
    expect(backup).not.toBeNull()
    expect(JSON.parse(await readFile(backup!, 'utf8'))).toEqual(userSettings)
    const written = await readFile(file, 'utf8')
    expect(written).toMatch(/^\{\n  "model"/)
    expect(written.endsWith('\n')).toBe(true)
  })
  it('creates the file (and its folder) when missing, with no backup', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'burrow-set-'))
    const file = join(dir, 'nested', 'settings.json')
    const { backup } = await updateSettingsFile(file, join(dir, 'backups'), (s) => addHooks(s, SCRIPT).settings)
    expect(backup).toBeNull()
    expect(Object.keys(JSON.parse(await readFile(file, 'utf8')).hooks)).toHaveLength(HOOKS.length)
  })
  it('refuses invalid JSON and leaves the file untouched', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'burrow-set-'))
    const file = join(dir, 'settings.json')
    const broken = '{ "model": "opus", // a comment\n}'
    await writeFile(file, broken)
    await expect(updateSettingsFile(file, join(dir, 'b'), (s) => addHooks(s, SCRIPT).settings)).rejects.toThrow(SettingsError)
    expect(await readFile(file, 'utf8')).toBe(broken)
    expect(await readdir(dir)).toEqual(['settings.json'])
  })
})

describe('round trips and links', () => {
  const fourSpace = JSON.stringify(
    { model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }], PreToolUse: [] }, statusLine: { type: 'command', command: 'x' } },
    null,
    4,
  )
  it('init then uninstall gives back the exact bytes of a 4-space file, user empties included', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'burrow-rt-'))
    const file = join(dir, 'settings.json')
    await writeFile(file, fourSpace)
    await updateSettingsFile(file, join(dir, 'b'), (s) => addHooks(s, SCRIPT).settings)
    expect(await readFile(file, 'utf8')).toMatch(/^\{\n {4}"model"/)
    await updateSettingsFile(file, join(dir, 'b'), (s) => removeHooks(s).settings)
    expect(await readFile(file, 'utf8')).toBe(fourSpace)
  })
  it('leaves empty containers it did not empty itself', () => {
    const s = { hooks: { PreToolUse: [], Stop: [{ hooks: [] }] } }
    expect(removeHooks(structuredClone(s))).toEqual({ settings: s, removed: 0 })
    expect(removeHooks({ hooks: {} }).settings).toEqual({ hooks: {} })
  })
  it('writes through a symlinked settings.json and keeps the link', async () => {
    const { symlink, lstat } = await import('node:fs/promises')
    const dir = await mkdtemp(join(tmpdir(), 'burrow-ln-'))
    const real = join(dir, 'real.json'), link = join(dir, 'settings.json')
    await writeFile(real, '{}\n')
    await symlink(real, link)
    await updateSettingsFile(link, join(dir, 'b'), (s) => addHooks(s, SCRIPT).settings)
    expect((await lstat(link)).isSymbolicLink()).toBe(true)
    expect(Object.keys(JSON.parse(await readFile(real, 'utf8')).hooks)).toHaveLength(HOOKS.length)
  })
})
