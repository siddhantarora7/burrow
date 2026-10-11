import { describe, expect, it } from 'vitest'
import type { PetState } from '@burrow/core'
import { alertChip, alertsFor, pokeAlerts } from '../lib/alerts'

const names = new Map([['me', 'kiwi'], ['jun', 'jun']])
const states = (o: Record<string, PetState>) => new Map(Object.entries(o))

describe('alertsFor: your agent starts waiting on you', () => {
  it('stays quiet on the first observation, even if your pet is already waving', () => {
    expect(alertsFor(null, states({ me: 'wave' }), 'me', names)).toEqual([])
  })
  it('alerts when your pet goes from anything to wave', () => {
    expect(alertsFor(states({ me: 'work' }), states({ me: 'wave' }), 'me', names)).toEqual([
      { kind: 'wave', title: 'kiwi needs you', body: 'your agent is waiting on you' },
    ])
  })
  it('does not repeat while it keeps waving', () => {
    expect(alertsFor(states({ me: 'wave' }), states({ me: 'wave' }), 'me', names)).toEqual([])
  })
  it("ignores a friend's wave, and everything when signed out", () => {
    expect(alertsFor(states({ jun: 'idle' }), states({ jun: 'wave' }), 'me', names)).toEqual([])
    expect(alertsFor(states({ me: 'idle' }), states({ me: 'wave' }), null, names)).toEqual([])
  })
})

describe('pokeAlerts', () => {
  const pokes = [{ from: 'jun', to: 'me', t: 5 }, { from: 'me', to: 'jun', t: 6 }, { from: 'jun', to: 'me', t: 9 }]
  it('alerts only for pokes at you that are new', () => {
    expect(pokeAlerts(pokes, 'me', 5, names)).toEqual([{ kind: 'poke', title: 'jun poked you', body: 'your agent is waiting on you' }])
  })
  it('never alerts when signed out', () => {
    expect(pokeAlerts(pokes, null, 0, names)).toEqual([])
  })
})

describe('alertChip', () => {
  it.each([
    [{ on: false, permission: 'granted', soundReady: true }, 'alerts off'],
    [{ on: true, permission: 'granted', soundReady: false }, 'click for sound'],
    [{ on: true, permission: 'denied', soundReady: false }, 'click for sound'],
    [{ on: true, permission: 'denied', soundReady: true }, 'chime only'],
    [{ on: true, permission: 'default', soundReady: true }, 'chime only'],
    [{ on: true, permission: 'granted', soundReady: true }, 'alerts on'],
  ] as const)('%j → %s', (input, label) => expect(alertChip(input)).toBe(label))
})
