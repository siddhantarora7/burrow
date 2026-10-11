import { describe, expect, it } from 'vitest'
import type { Ev, EventType } from '../src/events'
import { canPoke, POKE_GAP_MS } from '../src/poke'
import type { Member } from '../src/protocol'

const T0 = 1_791_000_000_000
const ev = (type: EventType, t: number): Ev => ({ v: 1, type, at: t, session: 'aaaaaaaaaaaa', t })
const member = (petId: string, events: Ev[] = []): Member => ({ petId, name: petId, species: 'mochi', color: 'sakura', joinedAt: 0, mealsTotal: 0, events })
const members = [member('aaaaaaaaaa'), member('bbbbbbbbbb', [ev('needs_input', T0)]), member('cccccccccc', [ev('prompt', T0)])]
const now = T0 + 30_000
const base = { from: 'aaaaaaaaaa', to: 'bbbbbbbbbb', members, now, lastPokeAt: undefined }

describe('canPoke', () => {
  it('lets a signed-in member poke a friend whose agent is waiting', () => {
    expect(canPoke(base)).toBe(true)
  })
  it.each([
    ['not signed in', { from: null }],
    ['the sender is not a member', { from: 'zzzzzzzzzz' }],
    ['poking yourself', { from: 'bbbbbbbbbb' }],
    ['the target is not a member', { to: 'zzzzzzzzzz' }],
    ['the target is not waiting', { to: 'cccccccccc' }],
    ['poked under a minute ago', { lastPokeAt: now - POKE_GAP_MS + 1 }],
  ])('refuses when %s', (_, over) => {
    expect(canPoke({ ...base, ...over })).toBe(false)
  })
  it('allows another poke once a full minute has passed', () => {
    expect(canPoke({ ...base, lastPokeAt: now - POKE_GAP_MS })).toBe(true)
  })
})
