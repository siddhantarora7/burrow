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
