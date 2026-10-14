import { describe, expect, it } from 'vitest'
import type { Ev, EventType, Member } from '@burrow/core'
import { fmtDur, shouldRefresh, statusLines, type GardenSnap } from '../src/statusline'
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
const today = { day: '2026-10-13', waitedMs: 6 * MIN, meals: 3, turns: 0, tasks: 0, activeMs: 134 * MIN, replies: 0, replyMs: 0, hourMs: Array<number>(24).fill(0) }
const TODAY = '2026-10-13'

describe('fmtDur', () => {
  it.each([[0, '0m'], [59_000, '0m'], [6 * MIN, '6m'], [134 * MIN, '2h14m'], [120 * MIN, '2h00m']])('%i ms is %s', (ms, s) => {
    expect(fmtDur(ms)).toBe(s)
  })
})

describe('statusLines', () => {
  it('shows your pet, its state, koban and your day', () => {
    const lines = statusLines({ claude: {}, me, snap: snap([member(me.petId, 'kiwi', [ev('prompt', NOW - 20_000)], { days: [today] })]), now: NOW, todayKey: TODAY, color: false })
    expect(lines).toEqual(['(•ᴗ•) kiwi working · 🪙 24 · 2h14m active · waited 6m'])
  })
  it('shows today\'s shared cost, else the session cost, and Claude\'s own limits when present', () => {
    const shared = statusLines({ claude: { cost: { total_cost_usd: 0.4 } }, me, snap: snap([member(me.petId, 'kiwi', [], { days: [{ ...today, costUsd: 13.5 }] })]), now: NOW, todayKey: TODAY, color: false })[0]
    expect(shared).toContain('$13.50 today')
    const session = statusLines({ claude: { cost: { total_cost_usd: 0.4 }, rate_limits: { five_hour: { used_percentage: 41.2 }, seven_day: { used_percentage: 32 } } }, me, snap: null, now: NOW, todayKey: TODAY, color: false })[0]
    expect(session).toBe('(•ᴗ•) kiwi · $0.40 session · 5h 41% · 7d 32%')
  })
  it('adds a second line only when a friend is waiting', () => {
    const friends = [
      member(me.petId, 'kiwi', []),
      member('ada0000000', 'ada', [ev('needs_input', NOW - 4 * MIN)]),
      member('jun0000000', 'jun', [ev('prompt', NOW - 20_000)]),
      member('mo00000000', 'mo', []),
    ]
    const lines = statusLines({ claude: {}, me, snap: snap(friends), now: NOW, todayKey: TODAY, color: false })
    expect(lines[1]).toBe('ada waiting 4m · jun working · mo asleep')
    expect(statusLines({ claude: {}, me, snap: snap(friends.filter((m) => m.name !== 'ada')), now: NOW, todayKey: TODAY, color: false })).toHaveLength(1)
  })
  it('uses colour only when asked', () => {
    const line = statusLines({ claude: {}, me, snap: null, now: NOW, todayKey: TODAY, color: true })[0]!
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

describe('statusLines: stale and odd input', () => {
  it('does not show yesterday as today', () => {
    const line = statusLines({ claude: {}, me, snap: snap([member(me.petId, 'kiwi', [], { days: [{ ...today, day: '2026-10-12', costUsd: 84.82 }] })]), now: NOW, todayKey: TODAY, color: false })[0]
    expect(line).not.toContain('84.82')
    expect(line).toContain('0m active')
  })
  it('ignores fields of the wrong type instead of failing', () => {
    const claude = { cost: { total_cost_usd: 'x' }, rate_limits: { five_hour: { used_percentage: 'lots' } } } as unknown as Parameters<typeof statusLines>[0]['claude']
    expect(statusLines({ claude, me, snap: null, now: NOW, todayKey: TODAY, color: false })).toEqual(['(•ᴗ•) kiwi'])
  })
})

describe('shouldRefresh: few requests, even when they fail', () => {
  it('refreshes after a minute while you work, five minutes otherwise', () => {
    expect(shouldRefresh({ now: NOW, fetchedAt: NOW - 61_000, active: true })).toBe(true)
    expect(shouldRefresh({ now: NOW, fetchedAt: NOW - 61_000, active: false })).toBe(false)
    expect(shouldRefresh({ now: NOW, fetchedAt: NOW - 301_000, active: false })).toBe(true)
    expect(shouldRefresh({ now: NOW, active: false })).toBe(true)
  })
  it('waits as long after a failed attempt as after a success', () => {
    expect(shouldRefresh({ now: NOW, fetchedAt: NOW - 600_000, attemptAt: NOW - 30_000, active: true })).toBe(false)
  })
})

describe('statusLines: a name changed on the website', () => {
  it('shows the garden\'s name for your pet over the one saved locally', () => {
    const line = statusLines({ claude: {}, me, snap: snap([member(me.petId, 'mochi kiwi', [])]), now: NOW, todayKey: TODAY, color: false })[0]
    expect(line!.startsWith('(•ᴗ•) mochi kiwi')).toBe(true)
  })
})
