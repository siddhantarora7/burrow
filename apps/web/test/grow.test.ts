import { describe, expect, it } from 'vitest'
import type { Member } from '@burrow/core'
import { discovered, ranks } from '../lib/grow'

const m = (petId: string, species: Member['species'], growth?: Member['growth']): Member => ({ petId, name: petId, species, color: 'sakura', joinedAt: 1, mealsTotal: 0, events: [], ...(growth ? { growth } : {}) })
const g = (xp: number, weekKoban: number, week = '2026-W42') => ({ xp, koban: 0, week, weekKoban })

describe('discovered', () => {
  it("is the garden's catalog plus every member's current form", () => {
    const d = discovered(['tofu:evolved'], [m('a', 'mochi', g(0, 0)), m('b', 'dango', g(150, 0))])
    expect([...d].sort()).toEqual(['dango:grown', 'mochi:baby', 'tofu:evolved'])
  })
  it('counts a pet from before growth existed as grown', () => {
    expect(discovered([], [m('a', 'onigiri')]).has('onigiri:grown')).toBe(true)
  })
})

describe('ranks', () => {
  it('orders by koban earned this week, then by xp', () => {
    const r = ranks([m('a', 'mochi', g(50, 9)), m('b', 'tofu', g(400, 12)), m('c', 'dango', g(120, 9))])
    expect(r.map((x) => x.member.petId)).toEqual(['b', 'c', 'a'])
    expect(r[0]).toMatchObject({ weekKoban: 12, stage: 'evolved' })
  })
  it("counts last week's koban as zero once anyone is in a newer week", () => {
    const r = ranks([m('a', 'mochi', g(10, 50, '2026-W41')), m('b', 'tofu', g(10, 3, '2026-W42'))])
    expect(r.map((x) => [x.member.petId, x.weekKoban])).toEqual([['b', 3], ['a', 0]])
  })
  it('ranks pets from before growth existed with nothing earned', () => {
    expect(ranks([m('a', 'mochi')])[0]).toMatchObject({ weekKoban: 0, stage: 'grown' })
  })
})

import { careState, stageRises } from '../lib/grow'

describe('careState', () => {
  const cares = [{ petId: 'a', effect: 'feed' as const, t: 1000 }, { petId: 'b', effect: 'play' as const, t: 5000 }]
  it('eats for 2.4 s after a feed and cheers for 2 s after a play', () => {
    expect(careState(cares, 'a', 3000)).toBe('eat')
    expect(careState(cares, 'a', 3401)).toBeNull()
    expect(careState(cares, 'b', 6999)).toBe('cheer')
    expect(careState(cares, 'b', 7001)).toBeNull()
  })
  it('only the newest care for that pet counts', () => {
    expect(careState([...cares, { petId: 'a', effect: 'play', t: 2000 }], 'a', 2500)).toBe('cheer')
  })
})

describe('stageRises', () => {
  it('names pets whose stage went up since last time, and remembers the new stages', () => {
    const prev = new Map([['a', 'baby'], ['b', 'grown']] as const)
    const { rises, stages } = stageRises(prev, [m('a', 'mochi', g(100, 0)), m('b', 'tofu', g(120, 0)), m('c', 'dango', g(500, 0))])
    expect(rises).toEqual([{ petId: 'a', name: 'a', stage: 'grown' }])
    expect(stages.get('c')).toBe('evolved')
  })
  it('stays quiet on first sight, so loading a garden never celebrates', () => {
    expect(stageRises(null, [m('a', 'mochi', g(500, 0))]).rises).toEqual([])
  })
})
