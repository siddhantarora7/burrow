import { describe, expect, it } from 'vitest'
import type { BurrowInfo, Ev, Member } from '@burrow/core'
import { initialState, reduce } from '../lib/burrowState'

const burrow: BurrowInfo = { id: 'abcdefghjk', name: "kiwi's burrow", env: 'garden', createdAt: 1, createdBy: 'p1' }
const member = (petId: string): Member => ({ petId, name: petId, species: 'mochi', color: 'sakura', joinedAt: 1, mealsTotal: 0, events: [] })
const ev = (type: Ev['type'], t: number): Ev => ({ v: 1, type, at: t, session: 'aaaaaaaaaaaa', t })

describe('burrow reducer', () => {
  it('snapshot goes live and records the server clock offset', () => {
    const s = reduce(initialState, { kind: 'msg', clientNow: 1000, msg: { t: 'snapshot', burrow, members: [member('p1')], serverNow: 4000 } })
    expect(s).toMatchObject({ status: 'live', burrow, offset: 3000 })
    expect(s.members).toHaveLength(1)
  })
  it('appends events to the right member and counts meals', () => {
    let s = reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1'), member('p2')], serverNow: 0 } })
    s = reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'event', petId: 'p2', ev: ev('stop', 10), serverNow: 10 } })
    expect(s.members[1]!.events).toEqual([ev('stop', 10)])
    expect(s.members[1]!.mealsTotal).toBe(1)
    expect(s.members[0]!.events).toEqual([])
  })
  it('caps stored events per member', () => {
    let s = reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1')], serverNow: 0 } })
    for (let i = 0; i < 80; i++) s = reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'event', petId: 'p1', ev: ev('heartbeat', i), serverNow: i } })
    expect(s.members[0]!.events).toHaveLength(50)
  })
  it('adds new members once', () => {
    let s = reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1')], serverNow: 0 } })
    s = reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'member', member: member('p2'), serverNow: 0 } })
    s = reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'member', member: member('p2'), serverNow: 0 } })
    expect(s.members.map((m) => m.petId)).toEqual(['p1', 'p2'])
  })
  it('not_found sticks; reconnecting keeps the last members', () => {
    expect(reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'error', code: 'not_found' } }).status).toBe('not_found')
    const live = reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1')], serverNow: 0 } })
    const r = reduce(live, { kind: 'status', status: 'reconnecting' })
    expect(r.status).toBe('reconnecting')
    expect(r.members).toHaveLength(1)
  })
  it('ignores events for unknown pets', () => {
    const live = reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1')], serverNow: 0 } })
    expect(reduce(live, { kind: 'msg', clientNow: 0, msg: { t: 'event', petId: 'zz', ev: ev('stop', 1), serverNow: 1 } })).toEqual(live)
  })
})
