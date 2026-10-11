import { mkdtemp, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { burrowHome, readConfig, writeConfig, type BurrowConfig } from '../src/config'

const cfg: BurrowConfig = {
  apiUrl: 'http://127.0.0.1:8787', webUrl: 'http://localhost:3000', petId: 'abcdefghjk',
  token: 'abcdefghjk.abcdefghjkmnpqrstvwxyz012', salt: '00'.repeat(16), burrows: ['mnpqrstvwx'],
  pet: { name: 'kiwi', species: 'mochi', color: 'sakura' },
}

describe('config', () => {
  it('honors BURROW_HOME', () => {
    expect(burrowHome({ BURROW_HOME: '/tmp/x' })).toBe('/tmp/x')
  })
  it('round-trips and is private to the user', async () => {
    const home = await mkdtemp(join(tmpdir(), 'burrow-'))
    await writeConfig(home, cfg)
    expect(await readConfig(home)).toEqual(cfg)
    expect((await stat(join(home, 'config.json'))).mode & 0o777).toBe(0o600)
  })
  it('returns null when missing or corrupt', async () => {
    const home = await mkdtemp(join(tmpdir(), 'burrow-'))
    expect(await readConfig(home)).toBeNull()
  })
})
