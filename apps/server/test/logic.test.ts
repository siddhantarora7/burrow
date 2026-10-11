import { describe, expect, it } from 'vitest'
import type { Ev } from '@burrow/core'
import { allowRate, localDate, pruneEvents, sha256Hex, validateHatch } from '../src/logic'

describe('sha256Hex', () => {
  it('matches the known vector', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('validateHatch', () => {
  it('cleans and defaults', () => {
    expect(validateHatch({ name: ' Kiwi ', species: 'tofu' })).toEqual({
      ok: true, value: { name: 'kiwi', species: 'tofu', color: 'matcha', tz: 'UTC' },
    })
  })
  it('keeps a valid tz and color', () => {
    const r = validateHatch({ name: 'k', species: 'mochi', color: 'sora', tz: 'America/Denver' })
    expect(r).toEqual({ ok: true, value: { name: 'k', species: 'mochi', color: 'sora', tz: 'America/Denver' } })
  })
  it.each([
    [{ species: 'mochi' }, 'name: 1-16 letters, digits, spaces, - or _'],
    [{ name: 'k', species: 'dragon' }, 'species must be mochi, tofu or onigiri'],
    [{ name: 'k', species: 'mochi', color: 'neon' }, 'unknown color'],
    [{ name: 'k', species: 'mochi', tz: 'Mars/Olympus' }, 'unknown time zone'],
    ['nope', 'body must be a JSON object'],
    [{ name: 'k', species: 'mochi', burrowId: 'nope' }, 'burrowId must be a burrow id'],
  ])('rejects %j', (body, error) => expect(validateHatch(body)).toEqual({ ok: false, error }))
  it('hatches into a friend\'s burrow when given its id', () => {
    const r = validateHatch({ name: 'k', species: 'tofu', burrowId: 'abcdefgh12' })
    expect(r).toEqual({ ok: true, value: { name: 'k', species: 'tofu', color: 'matcha', tz: 'UTC', burrowId: 'abcdefgh12' } })
  })
})

describe('pruneEvents', () => {
  const ev = (t: number): Ev => ({ v: 1, type: 'heartbeat', at: t, t, session: 'aaaaaaaaaaaa' })
  it('drops events older than 24 h and keeps at most 50, newest last', () => {
    const now = 100 * 3_600_000
    const events = [ev(now - 25 * 3_600_000), ...Array.from({ length: 60 }, (_, i) => ev(now - 60 + i))]
    const out = pruneEvents(events, now)
    expect(out).toHaveLength(50)
    expect(out[49]!.t).toBe(now - 1)
    expect(out.every((e) => e.t > now - 24 * 3_600_000)).toBe(true)
  })
})

describe('allowRate', () => {
  it('allows `limit` per window, then refuses', () => {
    let stamps: number[] = []
    for (let i = 0; i < 3; i++) {
      const r = allowRate(stamps, 1000 + i, 3, 60_000)
      expect(r.ok).toBe(true)
      stamps = r.stamps
    }
    expect(allowRate(stamps, 1010, 3, 60_000).ok).toBe(false)
    expect(allowRate(stamps, 61_001, 3, 60_000).ok).toBe(true)
  })
})

describe('localDate', () => {
  it('uses the pet owner time zone', () => {
    const t = Date.UTC(2026, 9, 5, 3, 0) // 03:00 UTC on Oct 5 = Oct 4 in Denver
    expect(localDate(t, 'America/Denver')).toBe('2026-10-04')
    expect(localDate(t, 'UTC')).toBe('2026-10-05')
  })
})
