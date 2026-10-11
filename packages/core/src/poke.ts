import { derive } from './derive'
import type { Member } from './protocol'

export const POKE_GAP_MS = 60_000
export const CLAIM_TTL_MS = 10 * 60_000

/** A signed-in member may poke a friend whose agent is waiting on them, once a minute. */
export function canPoke({ from, to, members, now, lastPokeAt }: {
  from: string | null
  to: string
  members: readonly Member[]
  now: number
  lastPokeAt: number | undefined
}): boolean {
  if (!from || from === to || !members.some((m) => m.petId === from)) return false
  const target = members.find((m) => m.petId === to)
  if (!target || derive({ events: target.events, now }).state !== 'wave') return false
  return lastPokeAt === undefined || now - lastPokeAt >= POKE_GAP_MS
}
