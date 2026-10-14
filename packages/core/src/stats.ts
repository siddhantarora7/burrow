import { TIMING } from './derive'
import type { Ev, WireUsage } from './events'
import { GROW } from './grow'
import type { WaitLedger } from './waits'

/** One pet-local day, worked out from events. Tokens and cost appear only when the owner shares usage. */
export interface DayStats {
  day: string
  waitedMs: number
  meals: number
  turns: number
  /** stops ending a run of GROW.minRunMs or more (the koban rule, uncapped) */
  tasks: number
  activeMs: number
  /** waits the human closed, and their total length */
  replies: number
  replyMs: number
  /** active ms in each pet-local hour, 24 entries */
  hourMs: number[]
  tokens?: number
  costUsd?: number
}

/** The last 7 days, oldest first, and when each live session was last heard from. Kept by PetDO. */
export interface StatsBook {
  days: DayStats[]
  seen: Record<string, number>
}

export interface FoldCtx {
  day: string
  hour: number
  /** the wait ledger from before this event */
  prev: WaitLedger
  runMs: number
  waitedMs: number
  meals: number
  usage?: WireUsage
}

const OPENS = new Set(['needs_input', 'error'])
const HOUR = 3_600_000
const DAY = 86_400_000
const SUMMED = ['waitedMs', 'meals', 'turns', 'tasks', 'activeMs', 'replies', 'replyMs'] as const

export const emptyDay = (day: string): DayStats => ({ day, waitedMs: 0, meals: 0, turns: 0, tasks: 0, activeMs: 0, replies: 0, replyMs: 0, hourMs: Array<number>(24).fill(0) })
export const emptyBook = (): StatsBook => ({ days: [], seen: {} })
const dayNum = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY

/**
 * Active time is the gap between a session's consecutive events, when it is no longer than the quiet
 * threshold and the session was not waiting on its human. It lands in the hour of the later event.
 */
export function foldStats(b: StatsBook, ev: Ev, c: FoldCtx): StatsBook {
  const last = b.days.at(-1)
  const today: DayStats = last?.day === c.day ? { ...last, hourMs: [...last.hourMs] } : emptyDay(c.day)
  const before = b.seen[ev.session]
  const opened = c.prev.open[ev.session]
  if (before !== undefined && opened === undefined) {
    const gap = ev.t - before
    if (gap > 0 && gap <= TIMING.quietMs) {
      today.activeMs += gap
      today.hourMs[c.hour]! += gap
    }
  }
  if (ev.type === 'prompt') today.turns++
  if (ev.type === 'stop' && c.runMs >= GROW.minRunMs) today.tasks++
  if (opened !== undefined && !OPENS.has(ev.type) && ev.type !== 'session_end') {
    today.replies++
    today.replyMs += Math.min(TIMING.waitMaxMs, Math.max(0, ev.t - opened))
  }
  if (c.usage?.tokens) today.tokens = (today.tokens ?? 0) + c.usage.tokens
  if (c.usage?.cost) today.costUsd = (today.costUsd ?? 0) + c.usage.cost
  today.waitedMs = c.waitedMs
  today.meals = c.meals

  const seen: Record<string, number> = {}
  for (const [s, t] of Object.entries(b.seen)) if (ev.t - t < HOUR) seen[s] = t
  if (ev.type === 'session_end') delete seen[ev.session]
  else seen[ev.session] = ev.t
  const days = [...b.days.filter((d) => d.day !== c.day && dayNum(c.day) - dayNum(d.day) < 7), today]
  return { days, seen }
}

/** The 7 days ending on `day`, summed (hours summed hour by hour). */
export function sumWeek(days: DayStats[], day: string): DayStats {
  const w = emptyDay(day)
  for (const d of days) {
    const age = dayNum(day) - dayNum(d.day)
    if (age < 0 || age >= 7) continue
    for (const k of SUMMED) w[k] += d[k]
    d.hourMs.forEach((ms, h) => (w.hourMs[h]! += ms))
    if (d.tokens !== undefined) w.tokens = (w.tokens ?? 0) + d.tokens
    if (d.costUsd !== undefined) w.costUsd = (w.costUsd ?? 0) + d.costUsd
  }
  return w
}
