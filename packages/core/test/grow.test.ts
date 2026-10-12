import { describe, expect, it } from 'vitest'
import type { Ev, EventType } from '../src/events'
import { care, earn, GROW, growthOf, LEGACY_XP, newGrowth, nextStageAt, publicGrowth, runLength, stageOf, weekOf, type Growth } from '../src/grow'
import { emptyLedger, foldWait, type WaitLedger } from '../src/waits'

const T0 = 1_791_000_000_000
const DAY = '2026-10-12'
const ev = (type: EventType, t: number, session = 'aaaaaaaaaaaa'): Ev => ({ v: 1, type, at: t, session, t })

/** Feeds events through the wait ledger and earn() the way PetDO does: earn sees the ledger before the event. */
function run(events: Ev[], g: Growth = newGrowth(DAY), day = DAY): Growth {
  let ledger: WaitLedger = emptyLedger(day)
  const seen: Ev[] = []
  for (const e of events) {
    g = earn(g, ledger, e, day, runLength(seen, e))
    ledger = foldWait(ledger, e, day)
    seen.push(e)
  }
  return g
}
/** A real task: a prompt, then the agent works for `ms` and stops. */
const task = (t: number, ms = 90_000, session = 'aaaaaaaaaaaa') => [ev('prompt', t, session), ev('heartbeat', t + ms / 2, session), ev('stop', t + ms, session)]

describe('stages', () => {
  it.each([[0, 'baby'], [99, 'baby'], [100, 'grown'], [399, 'grown'], [400, 'evolved'], [5000, 'evolved']] as const)('%i xp is %s', (xp, stage) => {
    expect(stageOf(xp)).toBe(stage)
  })
  it('knows the next threshold', () => {
    expect(nextStageAt(0)).toBe(100)
    expect(nextStageAt(150)).toBe(400)
    expect(nextStageAt(400)).toBeNull()
  })
})

describe('weekOf', () => {
  it.each([['2026-01-01', '2026-W01'], ['2025-12-29', '2026-W01'], ['2026-10-12', '2026-W42'], ['2026-10-11', '2026-W41'], ['2027-01-01', '2026-W53'], ['2027-01-04', '2027-W01']])('%s is %s', (day, week) => {
    expect(weekOf(day)).toBe(week)
  })
})

describe('earn', () => {
  it('pays 3 for a finished task, up to 30 a day', () => {
    expect(run(task(T0)).koban).toBe(3)
    const many = run(Array.from({ length: 31 }, (_, i) => task(T0 + i * 200_000)).flat())
    expect(many.koban).toBe(30 * GROW.stopPay)
    expect(many.stops).toBe(30)
  })

  it('a quick chat reply is not a task: the run must last a minute', () => {
    expect(run(task(T0, 20_000)).koban).toBe(0)
    expect(run(task(T0, 60_000)).koban).toBe(3)
  })

  it('a stop with no run before it pays nothing', () => {
    expect(run([ev('stop', T0)]).koban).toBe(0)
    expect(run([...task(T0), ev('stop', T0 + 200_000)]).koban).toBe(3)
  })

  it('pays 2 for answering within a minute, 1 within three, nothing later', () => {
    expect(run([ev('needs_input', T0), ev('prompt', T0 + 30_000)]).koban).toBe(2)
    expect(run([ev('needs_input', T0), ev('heartbeat', T0 + 120_000)]).koban).toBe(1)
    expect(run([ev('needs_input', T0), ev('prompt', T0 + 300_000)]).koban).toBe(0)
  })

  it('ending the session is not an answer', () => {
    expect(run([ev('needs_input', T0), ev('session_end', T0 + 5_000)]).koban).toBe(0)
  })

  it('pays a reply only in the session that was waiting', () => {
    expect(run([ev('needs_input', T0, 'aaaaaaaaaaaa'), ev('prompt', T0 + 10_000, 'bbbbbbbbbbbb')]).koban).toBe(0)
  })

  it('caps paid replies at 20 a day', () => {
    const evs = Array.from({ length: 21 }, (_, i) => [ev('needs_input', T0 + i * 60_000), ev('prompt', T0 + i * 60_000 + 5_000)]).flat()
    const g = run(evs)
    expect(g.replies).toBe(20)
    expect(g.koban).toBe(20 * GROW.quickPay)
  })

  it('resets the caps on a new day, but keeps the balance', () => {
    const full = run(Array.from({ length: 30 }, (_, i) => task(T0 + i * 200_000)).flat())
    const next = run(task(T0 + 86_400_000), full, '2026-10-13')
    expect(next.stops).toBe(1)
    expect(next.koban).toBe(31 * GROW.stopPay)
  })

  it('counts koban earned this week, and starts over on a new week', () => {
    const g = run(task(T0), newGrowth('2026-10-11'), '2026-10-11')
    expect(g.weekKoban).toBe(3)
    const monday = run(task(T0 + 86_400_000), g, '2026-10-12')
    expect(monday.week).toBe('2026-W42')
    expect(monday.weekKoban).toBe(3)
    expect(monday.koban).toBe(6)
  })

  it('ignores events that pay nothing', () => {
    const g = newGrowth(DAY)
    expect(run([ev('session_start', T0), ev('prompt', T0 + 1), ev('heartbeat', T0 + 2)], g)).toEqual(g)
  })
})

describe('care', () => {
  const rich: Growth = { ...newGrowth(DAY), koban: 8, weekKoban: 8 }
  it('feeding costs 5 and gives 10 xp; playing costs 3 and gives 5', () => {
    expect(care(rich, 'feed')).toMatchObject({ koban: 3, xp: 10 })
    expect(care(rich, 'play')).toMatchObject({ koban: 5, xp: 5 })
  })
  it('refuses without enough koban, so the balance never goes negative', () => {
    expect(care({ ...rich, koban: 4 }, 'feed')).toBeNull()
    expect(care({ ...rich, koban: 2 }, 'play')).toBeNull()
  })
  it('never lowers koban earned this week', () => {
    expect(care(rich, 'feed')!.weekKoban).toBe(8)
  })
})

describe('growthOf', () => {
  it('treats a pet from before growth existed as grown with nothing earned', () => {
    expect(growthOf({})).toEqual({ xp: LEGACY_XP, koban: 0, week: '', weekKoban: 0 })
    expect(stageOf(growthOf({}).xp)).toBe('grown')
  })
  it('publishes only the public fields', () => {
    expect(Object.keys(publicGrowth(newGrowth(DAY))).sort()).toEqual(['koban', 'week', 'weekKoban', 'xp'])
  })
})

describe('runLength', () => {
  it('measures from the first event after the session\'s last stop', () => {
    const before = [ev('prompt', T0), ev('stop', T0 + 5_000), ev('prompt', T0 + 10_000), ev('heartbeat', T0 + 40_000)]
    expect(runLength(before, ev('stop', T0 + 100_000))).toBe(90_000)
  })
  it('ignores other sessions, and is null when nothing ran since the last stop', () => {
    const before = [ev('prompt', T0, 'bbbbbbbbbbbb'), ev('stop', T0 + 1_000)]
    expect(runLength(before, ev('stop', T0 + 2_000))).toBeNull()
    expect(runLength(before, ev('prompt', T0 + 2_000))).toBeNull()
  })
})
