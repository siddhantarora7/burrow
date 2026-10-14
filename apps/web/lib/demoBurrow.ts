'use client'
import { useEffect, useState } from 'react'
import { MAX_MEMBERS, SPECIES, DEFAULT_COLOR, type Ev, type EventType, type Member, type DayStats } from '@burrow/core'
import type { BurrowState } from './burrowState'

const NAMES = ['kiwi', 'mika', 'jun', 'ada', 'theo', 'noor', 'sol', 'rin', 'bea', 'kai', 'lou', 'ivo', 'mei', 'oli', 'pax', 'remy', 'suki', 'tam', 'uma', 'vic', 'wren', 'yuki', 'zed', 'ash']

// A loose script for each synthetic pet: run, maybe ask for permission, finish, rest.
const CYCLE: Array<[EventType, number]> = [
  ['prompt', 0], ['heartbeat', 20_000], ['heartbeat', 40_000], ['needs_input', 55_000], ['heartbeat', 70_000], ['stop', 85_000], ['session_end', 100_000],
]

// Mixed stages and this week's koban, so the demo shows babies, evolved forms and a leaderboard.
const XP = [420, 150, 40, 260, 480, 20, 130, 90, 410, 60, 200, 10]
const WEEK_KOBAN = [64, 41, 22, 37, 58, 9, 30, 18, 51, 12, 27, 5]
/** Forms an older member of the demo garden reached before moving on. */
const DEMO_CATALOG = ['mochi:baby', 'tofu:baby', 'onigiri:grown', 'dorayaki:baby']

/** Made-up numbers for the stats panel: a work-day curve per pet, a few sharing usage. */
function demoDay(i: number, day: string): DayStats {
  const MIN = 60_000
  const hourMs = Array.from({ length: 24 }, (_, h) => {
    const peak = 10 + ((i * 3) % 8)
    const d = Math.abs(h - peak)
    return d > 5 || (h + i) % 7 === 0 ? 0 : Math.round((50 - d * 9) * MIN * (0.6 + ((i * 7) % 5) / 10))
  })
  const activeMs = hourMs.reduce((a, b) => a + b, 0)
  const s: DayStats = {
    day, hourMs, activeMs, waitedMs: (4 + ((i * 11) % 19)) * MIN, meals: 6, turns: 12 + ((i * 13) % 40),
    tasks: 3 + ((i * 5) % 11), replies: 2 + (i % 4), replyMs: (2 + (i % 4)) * (15_000 + ((i * 9_000) % 90_000)),
  }
  if (i % 3 === 0) Object.assign(s, { tokens: (8 + i * 17) * 1_000_000, costUsd: 6 + i * 9.5 })
  return s
}

/** Synthetic burrow for /demo: no network, every pet on its own staggered loop. */
export function useDemoBurrow(count: number): BurrowState {
  const n = Math.max(1, Math.min(MAX_MEMBERS, count))
  const [members, setMembers] = useState<Member[]>([])
  useEffect(() => {
    const start = Date.now()
    const base: Member[] = Array.from({ length: n }, (_, i) => {
      const species = SPECIES[i % SPECIES.length]!
      const growth = { xp: XP[i % XP.length]!, koban: 12, week: 'demo', weekKoban: WEEK_KOBAN[i % WEEK_KOBAN.length]! }
      const day = new Date(start).toLocaleDateString('en-CA')
      return { petId: `demo${i}`, name: NAMES[i]!, species, color: DEFAULT_COLOR[species], joinedAt: start, mealsTotal: 0, events: [], growth, today: demoDay(i, day), days: [4, 3, 2, 1, 0].map((ago) => demoDay(i + ago, new Date(start - ago * 86_400_000).toLocaleDateString('en-CA'))) }
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
  return { status: members.length ? 'live' : 'connecting', burrow: { id: 'demo', name: 'demo garden', env: 'garden', createdAt: 0, createdBy: 'demo' }, members, offset: 0, me: null, pokes: [], catalog: DEMO_CATALOG, cares: [] }
}
