import { describe, expect, it } from 'vitest'
import { TIMING } from '../src/derive'
import type { Ev, EventType } from '../src/events'
import { emptyLedger, foldWait, type WaitLedger } from '../src/waits'

const T0 = 1_791_000_000_000
const MIN = 60_000
const ev = (type: EventType, t: number, session = 'aaaaaaaaaaaa'): Ev => ({ v: 1, type, at: t, session, t })
const fold = (events: Ev[], day = '2026-10-11', start: WaitLedger = emptyLedger(day)) => events.reduce((l, e) => foldWait(l, e, day), start)

describe('foldWait: how long the agent waited on its human', () => {
  it('counts the gap from needs_input to the next event in that session', () => {
    expect(fold([ev('needs_input', T0), ev('prompt', T0 + 3 * MIN)]).waitedMs).toBe(3 * MIN)
  })
  it('counts an error (StopFailure) as waiting too', () => {
    expect(fold([ev('error', T0), ev('prompt', T0 + 2 * MIN)]).waitedMs).toBe(2 * MIN)
  })
  it('keeps the first start when the agent asks twice', () => {
    expect(fold([ev('needs_input', T0), ev('needs_input', T0 + MIN), ev('stop', T0 + 4 * MIN)]).waitedMs).toBe(4 * MIN)
  })
  it('caps one wait at the wave cap', () => {
    expect(fold([ev('needs_input', T0), ev('prompt', T0 + 90 * MIN)]).waitedMs).toBe(TIMING.waitMaxMs)
  })
  it('another session does not close the wait', () => {
    const l = fold([ev('needs_input', T0), ev('prompt', T0 + MIN, 'bbbbbbbbbbbb')])
    expect(l.waitedMs).toBe(0)
    expect(l.open).toEqual({ aaaaaaaaaaaa: T0 })
  })
  it('adds parallel sessions together', () => {
    const l = fold([ev('needs_input', T0), ev('needs_input', T0, 'bbbbbbbbbbbb'), ev('prompt', T0 + 2 * MIN), ev('prompt', T0 + 5 * MIN, 'bbbbbbbbbbbb')])
    expect(l.waitedMs).toBe(7 * MIN)
  })
  it('starts a new day at zero but keeps an open wait', () => {
    const yesterday = fold([ev('needs_input', T0), ev('prompt', T0 + 5 * MIN), ev('needs_input', T0 + 6 * MIN)], '2026-10-10')
    const today = foldWait(yesterday, ev('prompt', T0 + 8 * MIN), '2026-10-11')
    expect(today).toEqual({ day: '2026-10-11', waitedMs: 2 * MIN, open: {} })
  })
  it('closes abandoned waits at the cap so they never pile up', () => {
    const l = fold([ev('needs_input', T0), ev('prompt', T0 + 60 * MIN, 'bbbbbbbbbbbb')])
    expect(l.waitedMs).toBe(TIMING.waitMaxMs)
    expect(l.open).toEqual({})
  })
  it('never counts a negative gap when events arrive out of order', () => {
    expect(fold([ev('needs_input', T0 + MIN), ev('prompt', T0)]).waitedMs).toBe(0)
  })
  it('does not change the ledger it was given', () => {
    const l = emptyLedger('2026-10-11')
    foldWait(l, ev('needs_input', T0), '2026-10-11')
    expect(l).toEqual(emptyLedger('2026-10-11'))
  })
})
