import { describe, expect, it } from 'vitest'
import type { BurrowInfo, Ev, Member } from '@burrow/core'
import { initialState, reduce } from '../lib/burrowState'

const burrow: BurrowInfo = { id: 'abcdefghjk', name: "kiwi's burrow", env: 'garden', createdAt: 1, createdBy: 'p1' }
const member = (petId: string): Member => ({ petId, name: petId, species: 'mochi', color: 'sakura', joinedAt: 1, mealsTotal: 0, events: [] })
const ev = (type: Ev['type'], t: number): Ev => ({ v: 1, type, at: t, session: 'aaaaaaaaaaaa', t })

describe('burrow reducer', () => {
  it('snapshot goes live and records the server clock offset', () => {
    const s = reduce(initialState, { kind: 'msg', clientNow: 1000, msg: { t: 'snapshot', burrow, members: [member('p1')], catalog: [], serverNow: 4000 } })
    expect(s).toMatchObject({ status: 'live', burrow, offset: 3000 })
    expect(s.members).toHaveLength(1)
  })
  it('appends events to the right member and counts meals', () => {
    let s = reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1'), member('p2')], catalog: [], serverNow: 0 } })
    s = reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'event', petId: 'p2', ev: ev('stop', 10), serverNow: 10 } })
    expect(s.members[1]!.events).toEqual([ev('stop', 10)])
    expect(s.members[1]!.mealsTotal).toBe(1)
    expect(s.members[0]!.events).toEqual([])
  })
  it('caps stored events per member', () => {
    let s = reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1')], catalog: [], serverNow: 0 } })
    for (let i = 0; i < 80; i++) s = reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'event', petId: 'p1', ev: ev('heartbeat', i), serverNow: i } })
    expect(s.members[0]!.events).toHaveLength(50)
  })
  it('adds new members once', () => {
    let s = reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1')], catalog: [], serverNow: 0 } })
    s = reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'member', member: member('p2'), serverNow: 0 } })
    s = reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'member', member: member('p2'), serverNow: 0 } })
    expect(s.members.map((m) => m.petId)).toEqual(['p1', 'p2'])
  })
  it('not_found sticks; reconnecting keeps the last members', () => {
    expect(reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'error', code: 'not_found' } }).status).toBe('not_found')
    const live = reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1')], catalog: [], serverNow: 0 } })
    const r = reduce(live, { kind: 'status', status: 'reconnecting' })
    expect(r.status).toBe('reconnecting')
    expect(r.members).toHaveLength(1)
  })
  it('ignores events for unknown pets', () => {
    const live = reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1')], catalog: [], serverNow: 0 } })
    expect(reduce(live, { kind: 'msg', clientNow: 0, msg: { t: 'event', petId: 'zz', ev: ev('stop', 1), serverNow: 1 } })).toEqual(live)
  })
})

describe('burrow reducer: sign-in, pokes and today', () => {
  const live = () => reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1'), member('p2')], catalog: [], serverNow: 0 } })
  it('nobody is signed in until the server welcomes a token', () => {
    expect(live().me).toBeNull()
    expect(reduce(live(), { kind: 'msg', clientNow: 0, msg: { t: 'welcome', me: 'p1' } }).me).toBe('p1')
  })
  it('forgets a token the server no longer knows', () => {
    const s = reduce(live(), { kind: 'msg', clientNow: 0, msg: { t: 'welcome', me: 'p1' } })
    expect(reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'welcome', me: null } }).me).toBeNull()
  })
  it('a reconnect snapshot keeps who you are', () => {
    const s = reduce(live(), { kind: 'msg', clientNow: 0, msg: { t: 'welcome', me: 'p1' } })
    expect(reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1')], catalog: [], serverNow: 5 } }).me).toBe('p1')
  })
  it('records pokes, newest last, at most ten', () => {
    let s = live()
    for (let i = 0; i < 12; i++) s = reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'poke', from: 'p2', to: 'p1', serverNow: i } })
    expect(s.pokes).toHaveLength(10)
    expect(s.pokes.at(-1)).toEqual({ from: 'p2', to: 'p1', t: 11 })
  })
  it('an event carries the member\'s day so far', () => {
    const today = { day: '2026-10-11', waitedMs: 120_000, meals: 3 }
    const s = reduce(live(), { kind: 'msg', clientNow: 0, msg: { t: 'event', petId: 'p2', ev: ev('prompt', 10), today, serverNow: 10 } })
    expect(s.members[1]!.today).toEqual(today)
    expect(s.members[0]!.today).toBeUndefined()
  })
})

describe('growth in the burrow state', () => {
  const g = (xp: number, koban = 0) => ({ xp, koban, week: '2026-W42', weekKoban: koban })
  const live = () => reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1'), member('p2')], catalog: ['tofu:evolved'], serverNow: 0 } })

  it('keeps the garden catalog from the snapshot', () => {
    expect(live().catalog).toEqual(['tofu:evolved'])
  })
  it('an event carrying growth updates that member', () => {
    const s = reduce(live(), { kind: 'msg', clientNow: 0, msg: { t: 'event', petId: 'p2', ev: ev('stop', 10), growth: g(3, 3), serverNow: 10 } })
    expect(s.members[1]!.growth).toEqual(g(3, 3))
    expect(s.members[0]!.growth).toBeUndefined()
  })
  it('a grow message updates growth and remembers the care for the animation', () => {
    const s = reduce(live(), { kind: 'msg', clientNow: 0, msg: { t: 'grow', petId: 'p1', growth: g(10), effect: 'feed', serverNow: 50 } })
    expect(s.members[0]!.growth).toEqual(g(10))
    expect(s.cares).toEqual([{ petId: 'p1', effect: 'feed', t: 50 }])
  })
  it('keeps the last 10 cares', () => {
    let s = live()
    for (let i = 0; i < 12; i++) s = reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'grow', petId: 'p1', growth: g(i), effect: 'play', serverNow: i } })
    expect(s.cares).toHaveLength(10)
    expect(s.cares.at(-1)!.t).toBe(11)
  })
})
