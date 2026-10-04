import type { Ev, EventType } from './events'

export const TIMING = {
  eatMs: 6_000,
  cheerMs: 3_000,
  workDebounceMs: 15_000,
  staleMs: 10 * 60_000,
  waitMaxMs: 60 * 60_000,
  idleMs: 20 * 60_000,
} as const

export type PetState = 'idle' | 'eat' | 'wave' | 'work' | 'sleep' | 'cheer'
export const PET_STATES: readonly PetState[] = ['idle', 'eat', 'wave', 'work', 'sleep', 'cheer']

export interface DeriveInput {
  events: readonly Ev[]
  /** Server times of friends' `stop` events (for cheer). */
  friendStops?: readonly number[]
  now: number
}

export interface DeriveResult {
  state: PetState
  lastEventAt: number | null
  /** Earliest instant the state could change with no new event. May be early, never late. */
  nextChangeAt: number | null
}

type Phase = 'open' | 'running' | 'waiting' | 'done' | 'ended'
const PHASE: Record<EventType, Phase> = {
  session_start: 'open',
  prompt: 'running',
  heartbeat: 'running',
  needs_input: 'waiting',
  error: 'waiting',
  stop: 'done',
  session_end: 'ended',
}

const byTime = (a: Ev, b: Ev) => a.t - b.t || a.at - b.at

export function derive({ events, friendStops = [], now }: DeriveInput): DeriveResult {
  const past = events.filter((e) => e.t <= now).sort(byTime)
  const upcoming: number[] = []
  const later = (x: number) => {
    if (x > now) upcoming.push(x)
  }

  const last = past[past.length - 1]
  const lastEventAt = last ? last.t : null

  const sessions = new Map<string, Ev[]>()
  for (const e of past) {
    const list = sessions.get(e.session)
    if (list) list.push(e)
    else sessions.set(e.session, [e])
  }

  let waiting = false
  let working = false
  for (const evs of sessions.values()) {
    const tail = evs[evs.length - 1]!
    const phase = PHASE[tail.type]
    if (phase === 'waiting') {
      const end = tail.t + TIMING.waitMaxMs
      if (now < end) {
        waiting = true
        later(end)
      }
    } else if (phase === 'running') {
      const staleAt = tail.t + TIMING.staleMs
      if (now < staleAt) {
        later(staleAt)
        const runStart = runStartOf(evs)
        const matureAt = runStart + TIMING.workDebounceMs
        if (now >= matureAt) working = true
        else later(matureAt)
      }
    }
  }

  let lastStop: number | null = null
  for (const e of past) if (e.type === 'stop') lastStop = e.t
  const eating = lastStop !== null && now < lastStop + TIMING.eatMs
  if (lastStop !== null) later(lastStop + TIMING.eatMs)

  const active = lastEventAt !== null && now < lastEventAt + TIMING.idleMs
  if (lastEventAt !== null) later(lastEventAt + TIMING.idleMs)

  let state: PetState = waiting ? 'wave' : eating ? 'eat' : working ? 'work' : active ? 'idle' : 'sleep'

  let friend: number | null = null
  for (const f of friendStops) if (f <= now && (friend === null || f > friend)) friend = f
  if (friend !== null) {
    later(friend + TIMING.cheerMs)
    if ((state === 'work' || state === 'idle') && now < friend + TIMING.cheerMs) state = 'cheer'
  }

  return { state, lastEventAt, nextChangeAt: upcoming.length ? Math.min(...upcoming) : null }
}

/** Latest prompt in the session; else the first event of the trailing run of running events. */
function runStartOf(evs: readonly Ev[]): number {
  for (let i = evs.length - 1; i >= 0; i--) if (evs[i]!.type === 'prompt') return evs[i]!.t
  let i = evs.length - 1
  while (i > 0 && PHASE[evs[i - 1]!.type] === 'running') i--
  return evs[i]!.t
}
