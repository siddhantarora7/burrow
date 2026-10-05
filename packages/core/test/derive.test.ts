import { describe, expect, it } from 'vitest'
import { derive, TIMING, type PetState } from '../src/derive'
import type { Ev, EventType } from '../src/events'

const T0 = 1_791_000_000_000
const S = 1000, MIN = 60 * S
const ev = (type: EventType, t: number, session = 'aaaaaaaaaaaa'): Ev => ({ v: 1, type, at: t, session, t })
const at = (events: Ev[], now: number, friendStops: number[] = []) => derive({ events, now, friendStops })

describe('derive: single rules', () => {
  it('no events: asleep, nothing scheduled', () => {
    expect(at([], T0)).toEqual({ state: 'sleep', quiet: false, lastEventAt: null, nextChangeAt: null })
  })
  it('session_start alone is activity, not work', () => {
    expect(at([ev('session_start', T0)], T0 + S).state).toBe('idle')
  })
  it('a fresh prompt shows idle until the work debounce matures', () => {
    const r = at([ev('prompt', T0)], T0 + 5 * S)
    expect(r.state).toBe('idle')
    expect(r.nextChangeAt).toBe(T0 + TIMING.workDebounceMs)
  })
  it('a run of 15 s or more is work', () => {
    expect(at([ev('prompt', T0)], T0 + 15 * S).state).toBe('work')
  })
  it('heartbeats keep a long run working', () => {
    const events = [ev('prompt', T0), ev('heartbeat', T0 + 3 * MIN), ev('heartbeat', T0 + 6 * MIN), ev('heartbeat', T0 + 9 * MIN)]
    expect(at(events, T0 + 10 * MIN)).toMatchObject({ state: 'work', quiet: false })
  })
  it('a run silent for 2 min is shown as quiet (Claude may have been interrupted with Esc)', () => {
    const events = [ev('prompt', T0)]
    const early = at(events, T0 + MIN)
    expect(early).toMatchObject({ state: 'work', quiet: false, nextChangeAt: T0 + 2 * MIN })
    expect(at(events, T0 + 3 * MIN)).toMatchObject({ state: 'work', quiet: true })
  })
  it('a running session silent for 4 min is stale: idle, then asleep at 20 min', () => {
    const events = [ev('prompt', T0)]
    expect(at(events, T0 + 4 * MIN)).toMatchObject({ state: 'idle', quiet: false })
    expect(at(events, T0 + 20 * MIN).state).toBe('sleep')
  })
  it('stop: eats for 6 s, then idles', () => {
    const events = [ev('prompt', T0), ev('stop', T0 + 30 * S)]
    const r = at(events, T0 + 32 * S)
    expect(r).toMatchObject({ state: 'eat', lastEventAt: T0 + 30 * S, nextChangeAt: T0 + 36 * S })
    expect(at(events, T0 + 36 * S).state).toBe('idle')
  })
  it('needs_input waves', () => {
    expect(at([ev('prompt', T0), ev('needs_input', T0 + 20 * S)], T0 + 21 * S).state).toBe('wave')
  })
  it('error waves too: the agent needs you', () => {
    expect(at([ev('prompt', T0), ev('error', T0 + 20 * S)], T0 + 21 * S).state).toBe('wave')
  })
  it('a wave left for 20 min stops (rejected with Esc, crashed, or abandoned)', () => {
    const events = [ev('needs_input', T0)]
    expect(at(events, T0 + 19 * MIN).state).toBe('wave')
    expect(at(events, T0 + 20 * MIN).state).toBe('sleep')
  })
  it('session_end is activity: idle, asleep after 20 min', () => {
    const events = [ev('stop', T0), ev('session_end', T0 + MIN)]
    expect(at(events, T0 + 2 * MIN).state).toBe('idle')
    expect(at(events, T0 + 21 * MIN).state).toBe('sleep')
  })
})

describe('derive: priorities and sessions', () => {
  it('wave beats eat beats work', () => {
    const a = 'aaaaaaaaaaaa', b = 'bbbbbbbbbbbb', c = 'cccccccccccc'
    const events = [ev('prompt', T0, a), ev('prompt', T0, b), ev('stop', T0 + 60 * S, b), ev('needs_input', T0 + 61 * S, c)]
    expect(at(events, T0 + 62 * S).state).toBe('wave')
    expect(at(events.slice(0, 3), T0 + 62 * S).state).toBe('eat')
    expect(at(events.slice(0, 1), T0 + 62 * S).state).toBe('work')
  })
  it('one session done, another still running: work', () => {
    const events = [ev('prompt', T0, 'aaaaaaaaaaaa'), ev('stop', T0 + 10 * S, 'aaaaaaaaaaaa'), ev('prompt', T0, 'bbbbbbbbbbbb')]
    expect(at(events, T0 + 40 * S).state).toBe('work')
  })
  it('permission granted after a wave: back to work immediately, no new debounce', () => {
    const events = [ev('prompt', T0), ev('needs_input', T0 + MIN), ev('heartbeat', T0 + 2 * MIN)]
    expect(at(events, T0 + 2 * MIN + S)).toMatchObject({ state: 'work', quiet: false })
  })
  it('ignores events from the future', () => {
    expect(at([ev('stop', T0 + MIN)], T0).state).toBe('sleep')
  })
  it('does not depend on input order; ties break on `at`', () => {
    const a = ev('prompt', T0)
    const b: Ev = { ...ev('stop', T0), at: T0 + 1 }
    expect(at([b, a], T0 + S).state).toBe('eat')
    expect(at([a, b], T0 + S).state).toBe('eat')
  })
})

describe('derive: delivery order and clock skew', () => {
  it('orders a session by when things happened (`at`), not when requests arrived', () => {
    // The heartbeat hook process was slower than the permission notification.
    const needs: Ev = { v: 1, type: 'needs_input', at: T0 + 60_000, session: 'aaaaaaaaaaaa', t: T0 + 60_010 }
    const lateBeat: Ev = { v: 1, type: 'heartbeat', at: T0 + 59_900, session: 'aaaaaaaaaaaa', t: T0 + 60_050 }
    expect(at([ev('prompt', T0), needs, lateBeat], T0 + 61_000).state).toBe('wave')
  })
  it('schedules a wake-up for an event stamped slightly in the future', () => {
    const r = at([ev('prompt', T0), ev('stop', T0 + 60_005)], T0 + 60_000)
    expect(r.state).toBe('work')
    expect(r.nextChangeAt).toBe(T0 + 60_005)
    expect(at([ev('prompt', T0), ev('stop', T0 + 60_005)], T0 + 60_005).state).toBe('eat')
  })
  it('schedules a wake-up for a friend stop stamped in the future', () => {
    const r = at([ev('session_start', T0)], T0 + 10 * S, [T0 + 15 * S])
    expect(r.state).toBe('idle')
    expect(r.nextChangeAt).toBe(T0 + 15 * S)
  })
})

describe('derive: cheer', () => {
  it('cheers for 3 s when a friend ships while idle or working', () => {
    expect(at([ev('session_start', T0)], T0 + 10 * S, [T0 + 9 * S]).state).toBe('cheer')
    expect(at([ev('prompt', T0)], T0 + 60 * S, [T0 + 59 * S]).state).toBe('cheer')
    const r = at([ev('session_start', T0)], T0 + 10 * S, [T0 + 9 * S])
    expect(r.nextChangeAt).toBe(T0 + 12 * S)
    expect(at([ev('session_start', T0)], T0 + 12 * S, [T0 + 9 * S]).state).toBe('idle')
  })
  it('waving and eating pets do not cheer, sleeping pets stay asleep', () => {
    expect(at([ev('needs_input', T0)], T0 + S, [T0]).state).toBe('wave')
    expect(at([ev('stop', T0)], T0 + S, [T0]).state).toBe('eat')
    expect(at([], T0 + S, [T0]).state).toBe('sleep')
  })
})

describe('derive: nextChangeAt is never late (property)', () => {
  // Small seeded PRNG so failures reproduce.
  function rng(seed: number) {
    return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  }
  const TYPES: EventType[] = ['session_start', 'prompt', 'heartbeat', 'needs_input', 'stop', 'error', 'session_end']
  it('state is constant on [now, nextChangeAt)', () => {
    const rand = rng(42)
    for (let trial = 0; trial < 3000; trial++) {
      const events: Ev[] = []
      let t = T0
      const n = Math.floor(rand() * 8)
      for (let i = 0; i < n; i++) {
        t += Math.floor(rand() * 25 * MIN)
        const type = TYPES[Math.floor(rand() * TYPES.length)]!
        events.push(ev(type, t, rand() < 0.5 ? 'aaaaaaaaaaaa' : 'bbbbbbbbbbbb'))
      }
      const friendStops = rand() < 0.3 ? [t + Math.floor(rand() * 5 * S)] : []
      const now = t + Math.floor(rand() * 90 * MIN)
      const r = at(events, now, friendStops)
      const horizon = r.nextChangeAt ?? now + 24 * 60 * MIN
      expect(horizon).toBeGreaterThan(now)
      for (const p of [now + 1, Math.floor((now + horizon) / 2), horizon - 1]) {
        const later = at(events, p, friendStops)
        const s: PetState = later.state
        expect(s, `trial ${trial} at +${p - now}ms`).toBe(r.state)
        expect(later.quiet, `trial ${trial} quiet at +${p - now}ms`).toBe(r.quiet)
      }
    }
  })
})
