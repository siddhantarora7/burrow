import { describe, expect, it } from 'vitest'
import type { DayStats, Member } from '@burrow/core'
import { dayLine, fmtCost, fmtDur, fmtTokens, statRows } from '../lib/stats'

const MIN = 60_000
const day = (over: Partial<DayStats> = {}): DayStats => ({ day: '2026-10-13', waitedMs: 0, meals: 0, turns: 0, tasks: 0, activeMs: 0, replies: 0, replyMs: 0, hourMs: Array<number>(24).fill(0), ...over })
const member = (name: string, days?: DayStats[]): Member => ({ petId: name, name, species: 'mochi', color: 'sakura', joinedAt: 0, mealsTotal: 0, events: [], ...(days ? { days } : {}) })
const TODAY = '2026-10-13'

describe('statRows', () => {
  it('sorts by tasks, then active time, with missing stats last', () => {
    const rows = statRows([member('none'), member('b', [day({ tasks: 3, activeMs: 5 })]), member('a', [day({ tasks: 3, activeMs: 9 })]), member('c', [day({ tasks: 9 })])], 'today', TODAY)
    expect(rows.map((r) => r.member.name)).toEqual(['c', 'a', 'b', 'none'])
    expect(rows[3]!.s).toBeUndefined()
  })
  it('sums the week from the pet\'s days', () => {
    expect(statRows([member('a', [day({ day: '2026-10-11', tasks: 6 }), day({ tasks: 1 })])], 'week', TODAY)[0]!.s!.tasks).toBe(7)
  })
  it('shows nothing for today when the pet hasn\'t been heard from today', () => {
    expect(statRows([member('a', [day({ day: '2026-10-12', tasks: 6 })])], 'today', TODAY)[0]!.s).toBeUndefined()
  })
  it('drops days older than a week for an idle pet', () => {
    expect(statRows([member('a', [day({ day: '2026-10-01', tasks: 6 })])], 'week', TODAY)[0]!.s).toBeUndefined()
  })
})

describe('formatters', () => {
  it.each([[0, '0m'], [6 * MIN, '6m'], [134 * MIN, '2h 14m'], [120 * MIN, '2h']])('fmtDur %i', (ms, s) => expect(fmtDur(ms)).toBe(s))
  it.each([[999, '999'], [840_000, '840k'], [23_900_000, '23.9M'], [213_000_000, '213M']])('fmtTokens %i', (n, s) => expect(fmtTokens(n)).toBe(s))
  it('fmtCost', () => expect(fmtCost(13.5)).toBe('$13.50'))
})

describe('dayLine (on a pet\'s tag)', () => {
  it('says how much it worked today', () => {
    expect(dayLine(day({ activeMs: 134 * MIN, tasks: 9 }), '2026-10-13')).toBe('2h 14m active · 9 tasks')
    expect(dayLine(day({ activeMs: 3 * MIN, tasks: 1 }), '2026-10-13')).toBe('3m active · 1 task')
  })
  it('is empty for another day, or a quiet one', () => {
    expect(dayLine(day({ activeMs: 9 * MIN }), '2026-10-14')).toBeNull()
    expect(dayLine(day(), '2026-10-13')).toBeNull()
  })
})
