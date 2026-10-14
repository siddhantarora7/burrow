import { TIMING } from './derive'
import type { Ev, EventType } from './events'
import type { DayStats } from './stats'

/** How long a pet's agent has waited on its human today. Folded event by event in PetDO. */
export interface WaitLedger {
  /** The pet's local date (YYYY-MM-DD) the total belongs to. */
  day: string
  waitedMs: number
  /** session → when its current wait began */
  open: Record<string, number>
}

/** What a burrow shows about a pet's day. Gardens from before stats existed carry only the first three. */
export type Today = Pick<DayStats, 'day' | 'waitedMs' | 'meals'> & Partial<DayStats>

const OPENS: readonly EventType[] = ['needs_input', 'error']

export const emptyLedger = (day: string): WaitLedger => ({ day, waitedMs: 0, open: {} })

/**
 * A wait opens on needs_input or error and closes on that session's next other event, adding at most
 * TIMING.waitMaxMs (a pet stops waving then, so longer waits are someone who walked away). A wait spanning
 * midnight counts towards the day it closes.
 */
export function foldWait(l: WaitLedger, ev: Ev, day: string): WaitLedger {
  let waitedMs = day === l.day ? l.waitedMs : 0
  const open = { ...l.open }
  const close = (session: string, end: number) => {
    waitedMs += Math.min(TIMING.waitMaxMs, Math.max(0, end - open[session]!))
    delete open[session]
  }
  // abandoned waits elsewhere are closed at the cap, so the map never grows
  for (const s of Object.keys(open)) if (s !== ev.session && ev.t - open[s]! >= TIMING.waitMaxMs) close(s, ev.t)
  if (OPENS.includes(ev.type)) open[ev.session] ??= ev.t
  else if (open[ev.session] !== undefined) close(ev.session, ev.t)
  return { day, waitedMs, open }
}
