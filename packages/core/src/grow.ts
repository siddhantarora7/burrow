import type { Ev } from './events'
import type { Species } from './species'
import type { WaitLedger } from './waits'

// Pets grow on koban, earned from what the hooks already send: finished tasks and quick replies to a
// waiting agent. Caps per pet-local day bound what faked events can earn.
export const GROW = {
  stopPay: 3,
  /** Claude Code fires Stop at the end of every reply; only a run that worked this long counts as a task. */
  minRunMs: 60_000,
  quickPay: 2,
  okPay: 1,
  quickMs: 60_000,
  okMs: 180_000,
  stopCap: 30,
  replyCap: 20,
  feed: { cost: 5, xp: 10 },
  play: { cost: 3, xp: 5 },
  grownAt: 100,
  evolvedAt: 400,
} as const

/** Pets hatched before growth existed start grown, so nobody's pet shrinks. */
export const LEGACY_XP = 100

export const STAGES = ['baby', 'grown', 'evolved'] as const
export type Stage = (typeof STAGES)[number]

/** What a garden sees about a pet's growth. */
export interface PetGrowth {
  xp: number
  koban: number
  /** ISO week (`2026-W42`) that `weekKoban` belongs to. */
  week: string
  /** Koban earned (not spent) this week: the garden leaderboard. */
  weekKoban: number
}

/** PetDO's full record: the public part plus today's earning counters. */
export interface Growth extends PetGrowth {
  /** The pet's local date (YYYY-MM-DD) the counters belong to. */
  day: string
  stops: number
  replies: number
}

export const stageOf = (xp: number): Stage => (xp >= GROW.evolvedAt ? 'evolved' : xp >= GROW.grownAt ? 'grown' : 'baby')

/** xp at which the next stage starts, or null once evolved. */
export const nextStageAt = (xp: number): number | null => (xp < GROW.grownAt ? GROW.grownAt : xp < GROW.evolvedAt ? GROW.evolvedAt : null)

/** ISO 8601 week of a local date: weeks start on Monday and belong to the year of their Thursday. */
export function weekOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(y, m - 1, d))
  const dow = (date.getUTCDay() + 6) % 7 // Monday 0
  date.setUTCDate(date.getUTCDate() - dow + 3) // that week's Thursday
  const year = date.getUTCFullYear()
  const week = 1 + Math.floor((date.getTime() - Date.UTC(year, 0, 1)) / 604_800_000)
  return `${year}-W${String(week).padStart(2, '0')}`
}

export const newGrowth = (day: string, xp = 0): Growth => ({ xp, koban: 0, week: weekOf(day), weekKoban: 0, day, stops: 0, replies: 0 })

export const publicGrowth = ({ xp, koban, week, weekKoban }: PetGrowth): PetGrowth => ({ xp, koban, week, weekKoban })

/** A member's growth; members from before growth existed are grown with nothing earned. */
export const growthOf = (m: { growth?: PetGrowth }): PetGrowth => m.growth ?? { xp: LEGACY_XP, koban: 0, week: '', weekKoban: 0 }

const OPENS = new Set(['needs_input', 'error'])

/**
 * How long the run a stop ends lasted: from the session's first event after its previous stop. `before`
 * is the pet's stored events before this one. Null for anything but a stop, or a stop with no run before it.
 */
export function runLength(before: readonly Ev[], ev: Ev): number | null {
  if (ev.type !== 'stop') return null
  let start: number | null = null
  for (const e of before) {
    if (e.session !== ev.session) continue
    if (e.type === 'stop') start = null
    else start ??= e.t
  }
  return start === null ? null : ev.t - start
}

/**
 * Folds one event into a pet's growth. `prev` is the wait ledger before this event, so a reply's wait is
 * `ev.t - prev.open[ev.session]`; `runMs` is runLength() for a stop. Day and week counters roll over first,
 * on the pet's local date.
 */
export function earn(g: Growth, prev: WaitLedger, ev: Ev, day: string, runMs: number | null = null): Growth {
  let next = g
  if (day !== g.day) next = { ...next, day, stops: 0, replies: 0 }
  const week = weekOf(day)
  if (week !== next.week) next = { ...next, week, weekKoban: 0 }

  const pay = (koban: number, counter: 'stops' | 'replies') => {
    next = { ...next, koban: next.koban + koban, weekKoban: next.weekKoban + koban, [counter]: next[counter] + 1 }
  }
  const opened = prev.open[ev.session]
  // closing the session is walking away, not answering
  if (!OPENS.has(ev.type) && ev.type !== 'session_end' && opened !== undefined && next.replies < GROW.replyCap) {
    const waited = ev.t - opened
    if (waited <= GROW.quickMs) pay(GROW.quickPay, 'replies')
    else if (waited <= GROW.okMs) pay(GROW.okPay, 'replies')
  }
  if (ev.type === 'stop' && runMs !== null && runMs >= GROW.minRunMs && next.stops < GROW.stopCap) pay(GROW.stopPay, 'stops')
  return next
}

export const CARE_ACTIONS = ['feed', 'play'] as const
export type CareAction = (typeof CARE_ACTIONS)[number]
export const isCareAction = (x: unknown): x is CareAction => x === 'feed' || x === 'play'

/** Spends koban on the pet; null when there aren't enough. Never touches weekKoban (earned, not held). */
export function care<G extends PetGrowth>(g: G, action: CareAction): G | null {
  const { cost, xp } = GROW[action]
  return g.koban < cost ? null : { ...g, koban: g.koban - cost, xp: g.xp + xp }
}

/** A catalog entry: one species at one stage. */
export const formKey = (species: Species, stage: Stage) => `${species}:${stage}`
