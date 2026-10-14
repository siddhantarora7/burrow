import { describe, expect, it } from 'vitest'
import type { DayStats, Member } from '@burrow/core'
import { spark, statsTable } from '../src/table'

const MIN = 60_000
const day = (over: Partial<DayStats>): DayStats => ({ day: '2026-10-13', waitedMs: 0, meals: 0, turns: 0, tasks: 0, activeMs: 0, replies: 0, replyMs: 0, hourMs: Array<number>(24).fill(0), ...over })
const member = (petId: string, name: string, today?: DayStats, week?: DayStats): Member => ({
  petId, name, species: 'mochi', color: 'sakura', joinedAt: 0, mealsTotal: 0, events: [], ...(today ? { today } : {}), ...(week ? { week } : {}),
})
const base = { burrowName: "kiwi's garden", me: 'kiwi000000', webUrl: 'https://burrow.test', burrowId: 'abc', color: false, now: 0 }

describe('spark', () => {
  it('draws one block per value, scaled to the max', () => {
    expect(spark([0, 5, 10], 10)).toBe('▁▅█')
    expect(spark([0, 0], 0)).toBe('▁▁')
  })
})

describe('statsTable', () => {
  const members = [
    member('jun0000000', 'jun'),
    member('kiwi000000', 'kiwi', day({ tasks: 9, turns: 14, activeMs: 134 * MIN, waitedMs: 6 * MIN, replies: 2, replyMs: 36_000, tokens: 23_900_000, costUsd: 13.5 })),
    member('ada0000000', 'ada', day({ tasks: 14, turns: 61, activeMs: 182 * MIN, waitedMs: 22 * MIN, replies: 1, replyMs: 120_000, tokens: 840_000 })),
  ]
  const out = statsTable({ ...base, members, week: false })
  const rows = out.split('\n')
  it('sorts by tasks, then active time, and marks your row', () => {
    const order = rows.filter((r) => /^\s+(→|\d)/.test(r)).map((r) => r.trim().split(/\s+/).slice(0, 2).join(' '))
    expect(order).toEqual(['1 ada', '→2 kiwi', '3 jun'])
  })
  it('formats tokens, cost, replies and missing values', () => {
    const kiwi = rows.find((r) => r.includes('kiwi '))!
    expect(kiwi).toMatch(/2h14m\s+9\s+14\s+6m\s+18s\s+23\.9M\s+\$13\.50/)
    const ada = rows.find((r) => r.includes('ada '))!
    expect(ada).toMatch(/2m\s+840k\s+–/)
    expect(rows.find((r) => r.includes('jun '))).toMatch(/0m\s+0\s+0\s+–\s+–\s+–\s+–/)
  })
  it('has a header, an activity strip and the links', () => {
    expect(out).toContain("kiwi's garden · today · 3 members")
    expect(out).toContain('activity (24h)')
    expect(out).toContain('garden  https://burrow.test/b/abc')
    expect(out).toContain('invite  npx burrow-pets init https://burrow.test/b/abc')
  })
  it('reads the week when asked', () => {
    const w = statsTable({ ...base, members: [member('kiwi000000', 'kiwi', day({ tasks: 1 }), day({ tasks: 40 }))], week: true })
    expect(w).toContain('this week')
    expect(w).toMatch(/kiwi\s+0m\s+40/)
  })
})
