import { describe, expect, it } from 'vitest'
import { TIMING } from '../src/derive'
import type { Ev, EventType } from '../src/events'
import { emptyBook, emptyDay, foldStats, sumWeek, type DayStats, type FoldCtx, type StatsBook } from '../src/stats'
import { emptyLedger } from '../src/waits'

const T0 = 1_791_000_000_000
const MIN = 60_000
const ev = (type: EventType, t: number, session = 'aaaaaaaaaaaa'): Ev => ({ v: 1, type, at: t, session, t })
const ctx = (over: Partial<FoldCtx> = {}): FoldCtx => ({ day: '2026-10-13', hour: 14, prev: emptyLedger('2026-10-13'), runMs: 0, waitedMs: 0, meals: 0, ...over })
const today = (b: StatsBook) => b.days.at(-1)!
const run = (events: Ev[], c: Partial<FoldCtx> = {}) => events.reduce((b, e) => foldStats(b, e, ctx(c)), emptyBook())

describe('foldStats: a pet day from events', () => {
  it('counts a prompt as a turn', () => {
    expect(today(run([ev('prompt', T0)])).turns).toBe(1)
  })
  it('counts a stop ending a run of a minute as a task, not a shorter one', () => {
    expect(today(foldStats(emptyBook(), ev('stop', T0), ctx({ runMs: 60_000 }))).tasks).toBe(1)
    expect(today(foldStats(emptyBook(), ev('stop', T0), ctx({ runMs: 59_999 }))).tasks).toBe(0)
  })
  it('adds the gap between a session\'s events as active time, in that hour', () => {
    const d = today(run([ev('prompt', T0), ev('heartbeat', T0 + 90_000)]))
    expect(d.activeMs).toBe(90_000)
    expect(d.hourMs[14]).toBe(90_000)
  })
  it('ignores gaps longer than the quiet threshold', () => {
    expect(today(run([ev('prompt', T0), ev('heartbeat', T0 + 3 * MIN)])).activeMs).toBe(0)
  })
  it('does not count time spent waiting on the human as active', () => {
    const waiting = { ...emptyLedger('2026-10-13'), open: { aaaaaaaaaaaa: T0 } }
    const b = foldStats(emptyBook(), ev('needs_input', T0), ctx())
    expect(today(foldStats(b, ev('prompt', T0 + MIN), ctx({ prev: waiting }))).activeMs).toBe(0)
  })
  it('records a reply that closes a wait', () => {
    const waiting = { ...emptyLedger('2026-10-13'), open: { aaaaaaaaaaaa: T0 } }
    const d = today(foldStats(emptyBook(), ev('prompt', T0 + 30_000), ctx({ prev: waiting })))
    expect([d.replies, d.replyMs]).toEqual([1, 30_000])
  })
  it('does not count session_end as a reply, and caps a long wait', () => {
    const waiting = { ...emptyLedger('2026-10-13'), open: { aaaaaaaaaaaa: T0 } }
    expect(today(foldStats(emptyBook(), ev('session_end', T0 + MIN), ctx({ prev: waiting }))).replies).toBe(0)
    expect(today(foldStats(emptyBook(), ev('prompt', T0 + 40 * MIN), ctx({ prev: waiting }))).replyMs).toBe(TIMING.waitMaxMs)
  })
  it('adds shared usage, and leaves tokens and cost undefined without it', () => {
    const d = today(foldStats(emptyBook(), ev('stop', T0), ctx({ usage: { tokens: 1200, cost: 0.4 } })))
    expect([d.tokens, d.costUsd]).toEqual([1200, 0.4])
    const plain = today(run([ev('stop', T0)]))
    expect([plain.tokens, plain.costUsd]).toEqual([undefined, undefined])
  })
  it('starts a fresh day and copies waited time and meals from the context', () => {
    const b = foldStats(run([ev('prompt', T0)]), ev('prompt', T0 + MIN), ctx({ day: '2026-10-14', waitedMs: 5, meals: 2 }))
    expect(b.days.map((d) => d.day)).toEqual(['2026-10-13', '2026-10-14'])
    expect(today(b)).toMatchObject({ turns: 1, waitedMs: 5, meals: 2 })
  })
  it('forgets a session on session_end and anything older than an hour', () => {
    const b = run([ev('prompt', T0), ev('prompt', T0, 'bbbbbbbbbbbb'), ev('session_end', T0 + MIN)])
    expect(Object.keys(b.seen)).toEqual(['bbbbbbbbbbbb'])
    expect(Object.keys(foldStats(b, ev('prompt', T0 + 61 * MIN, 'cccccccccccc'), ctx()).seen)).toEqual(['cccccccccccc'])
  })
  it('keeps only the last 7 days', () => {
    let b = emptyBook()
    for (let i = 1; i <= 9; i++) b = foldStats(b, ev('prompt', T0 + i), ctx({ day: `2026-10-0${i}` }))
    expect(b.days.map((d) => d.day)).toEqual(['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'])
  })
})

describe('sumWeek', () => {
  const day = (d: string, over: Partial<DayStats> = {}): DayStats => ({ ...emptyDay(d), turns: 1, ...over })
  it('sums the 7 days ending on the given day, hour by hour', () => {
    const h = Array<number>(24).fill(0)
    h[9] = 100
    const w = sumWeek([day('2026-10-06'), day('2026-10-07', { hourMs: h }), day('2026-10-13', { hourMs: h, tokens: 10 })], '2026-10-13')
    expect(w.turns).toBe(2)
    expect(w.hourMs[9]).toBe(200)
    expect(w.tokens).toBe(10)
    expect(w.costUsd).toBeUndefined()
  })
})
