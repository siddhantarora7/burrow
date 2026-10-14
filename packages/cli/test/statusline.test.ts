import { describe, expect, it } from 'vitest'
import type { Ev, EventType, Member } from '@burrow/core'
import { fmtDur, statusLines, type GardenSnap } from '../src/statusline'
import { addStatusLine, removeStatusLine } from '../src/settings'

const NOW = 1_791_000_000_000
const MIN = 60_000
const ev = (type: EventType, t: number): Ev => ({ v: 1, type, at: t, session: 'aaaaaaaaaaaa', t })
const member = (petId: string, name: string, events: Ev[], over: Partial<Member> = {}): Member => ({
  petId, name, species: 'mochi', color: 'sakura', joinedAt: 0, mealsTotal: 0, events,
  growth: { xp: 120, koban: 24, week: '2026-W42', weekKoban: 30 }, ...over,
})
const me = { petId: 'kiwi000000', name: 'kiwi', species: 'mochi' as const }
const snap = (members: Member[]): GardenSnap => ({ members, serverNow: NOW, fetchedAt: NOW })
const today = { day: '2026-10-13', waitedMs: 6 * MIN, meals: 3, activeMs: 134 * MIN }

describe('fmtDur', () => {
  it.each([[0, '0m'], [59_000, '0m'], [6 * MIN, '6m'], [134 * MIN, '2h14m'], [120 * MIN, '2h00m']])('%i ms is %s', (ms, s) => {
    expect(fmtDur(ms)).toBe(s)
  })
})

describe('statusLines', () => {
  it('shows your pet, its state, koban and your day', () => {
    const lines = statusLines({ claude: {}, me, snap: snap([member(me.petId, 'kiwi', [ev('prompt', NOW - 20_000)], { today })]), now: NOW, color: false })
    expect(lines).toEqual(['(•ᴗ•) kiwi working · 🪙 24 · 2h14m active · waited 6m'])
  })
  it('shows today\'s shared cost, else the session cost, and Claude\'s own limits when present', () => {
    const shared = statusLines({ claude: { cost: { total_cost_usd: 0.4 } }, me, snap: snap([member(me.petId, 'kiwi', [], { today: { ...today, costUsd: 13.5 } })]), now: NOW, color: false })[0]
    expect(shared).toContain('$13.50 today')
    const session = statusLines({ claude: { cost: { total_cost_usd: 0.4 }, rate_limits: { five_hour: { used_percentage: 41.2 }, seven_day: { used_percentage: 32 } } }, me, snap: null, now: NOW, color: false })[0]
    expect(session).toBe('(•ᴗ•) kiwi · $0.40 session · 5h 41% · 7d 32%')
  })
  it('adds a second line only when a friend is waiting', () => {
    const friends = [
      member(me.petId, 'kiwi', []),
      member('ada0000000', 'ada', [ev('needs_input', NOW - 4 * MIN)]),
      member('jun0000000', 'jun', [ev('prompt', NOW - 20_000)]),
      member('mo00000000', 'mo', []),
    ]
    const lines = statusLines({ claude: {}, me, snap: snap(friends), now: NOW, color: false })
    expect(lines[1]).toBe('ada waiting 4m · jun working · mo asleep')
    expect(statusLines({ claude: {}, me, snap: snap(friends.filter((m) => m.name !== 'ada')), now: NOW, color: false })).toHaveLength(1)
  })
  it('uses colour only when asked', () => {
    const line = statusLines({ claude: {}, me, snap: null, now: NOW, color: true })[0]!
    expect(line).toContain('\x1b[')
  })
})

describe('addStatusLine / removeStatusLine', () => {
  const cmd = 'node "/home/me/.burrow/burrow-statusline.mjs"'
  it('becomes the status line when there is none', () => {
    expect(addStatusLine({}, cmd)).toEqual({ settings: { statusLine: { type: 'command', command: cmd, refreshInterval: 30 } } })
  })
  it('keeps your own status line to run first', () => {
    const r = addStatusLine({ statusLine: { type: 'command', command: 'ccstatusline' } }, cmd)
    expect(r.then).toBe('ccstatusline')
    expect((r.settings.statusLine as { command: string }).command).toBe(cmd)
  })
  it('is unchanged when burrow\'s is already there', () => {
    const s = { statusLine: { type: 'command', command: cmd, refreshInterval: 30 } }
    expect(addStatusLine(s, cmd)).toEqual({ settings: s })
  })
  it('restores the previous status line, or removes its own, and leaves others alone', () => {
    const ours = { statusLine: { type: 'command', command: cmd } }
    expect(removeStatusLine(ours, 'ccstatusline')).toEqual({ statusLine: { type: 'command', command: 'ccstatusline' } })
    expect(removeStatusLine(ours)).toEqual({})
    const theirs = { statusLine: { type: 'command', command: 'ccstatusline' } }
    expect(removeStatusLine(theirs, 'x')).toEqual(theirs)
  })
})
