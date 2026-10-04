import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkSettings, installHooks } from '../src/install'
import { HOOKS, SettingsError } from '../src/settings'

describe('installHooks', () => {
  it('installs on first run and is a no-op on the second, so init can be re-run safely', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'burrow-inst-'))
    const settings = join(dir, 'settings.json')
    const home = join(dir, 'home')
    const src = join(dir, 'burrow-hook.mjs')
    await writeFile(src, '// hook')
    expect(await installHooks({ home, settingsPath: settings, hookSource: src })).toEqual(HOOKS.map(([e]) => e))
    expect(await installHooks({ home, settingsPath: settings, hookSource: src })).toEqual([])
    expect(await readFile(join(home, 'burrow-hook.mjs'), 'utf8')).toBe('// hook')
  })
})

describe('checkSettings', () => {
  it('rejects invalid JSON before anything is hatched', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'burrow-chk-'))
    const settings = join(dir, 'settings.json')
    await writeFile(settings, '{ nope')
    await expect(checkSettings(settings)).rejects.toThrow(SettingsError)
  })
  it('accepts a missing file and odd-but-valid settings', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'burrow-chk-'))
    await expect(checkSettings(join(dir, 'missing.json'))).resolves.toBeUndefined()
    await writeFile(join(dir, 's.json'), '{"hooks":{}}')
    await expect(checkSettings(join(dir, 's.json'))).resolves.toBeUndefined()
  })
  it('rejects shapes burrow cannot merge into', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'burrow-chk-'))
    await writeFile(join(dir, 's.json'), '{"hooks":[]}')
    await expect(checkSettings(join(dir, 's.json'))).rejects.toThrow(SettingsError)
  })
})
