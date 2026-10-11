'use client'
import { useEffect, useState } from 'react'
import { MAX_MEMBERS, SPECIES, DEFAULT_COLOR, type Ev, type EventType, type Member } from '@burrow/core'
import type { BurrowState } from './burrowState'

const NAMES = ['kiwi', 'mika', 'jun', 'ada', 'theo', 'noor', 'sol', 'rin', 'bea', 'kai', 'lou', 'ivo', 'mei', 'oli', 'pax', 'remy', 'suki', 'tam', 'uma', 'vic', 'wren', 'yuki', 'zed', 'ash']

// A loose script for each synthetic pet: run, maybe ask for permission, finish, rest.
const CYCLE: Array<[EventType, number]> = [
  ['prompt', 0], ['heartbeat', 20_000], ['heartbeat', 40_000], ['needs_input', 55_000], ['heartbeat', 70_000], ['stop', 85_000], ['session_end', 100_000],
]

/** Synthetic burrow for /demo: no network, every pet on its own staggered loop. */
export function useDemoBurrow(count: number): BurrowState {
  const n = Math.max(1, Math.min(MAX_MEMBERS, count))
  const [members, setMembers] = useState<Member[]>([])
  useEffect(() => {
    const start = Date.now()
    const base: Member[] = Array.from({ length: n }, (_, i) => {
      const species = SPECIES[i % SPECIES.length]!
      return { petId: `demo${i}`, name: NAMES[i]!, species, color: DEFAULT_COLOR[species], joinedAt: start, mealsTotal: 0, events: [] }
    })
    const period = 110_000
    const tick = () => {
      const now = Date.now()
      setMembers(
        base.map((m, i) => {
          // stagger loops; a few pets sit some loops out so the garden always has sleepers and idlers
          const offsetMs = (i * 37_000) % period
          const events: Ev[] = []
          for (let loop = Math.floor((now - start + offsetMs) / period) - 1; loop <= Math.floor((now - start + offsetMs) / period); loop++) {
            if ((i + loop) % 4 === 3) continue
            for (const [type, at] of CYCLE) {
              if (i % 3 === 2 && type === 'needs_input') continue
              const t = start - offsetMs + loop * period + at
              if (t <= now) events.push({ v: 1, type, at: t, t, session: (i * 4096 + (loop & 4095)).toString(16).padStart(12, '0') })
            }
          }
          return { ...m, events }
        }),
      )
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [n])
  return { status: members.length ? 'live' : 'connecting', burrow: { id: 'demo', name: 'demo garden', env: 'garden', createdAt: 0, createdBy: 'demo' }, members, offset: 0, me: null, pokes: [] }
}
