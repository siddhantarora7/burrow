import type { Ev } from './events'
import type { PetColor, Species } from './species'
import type { Today } from './waits'

export type EnvName = 'garden'

export interface MemberProfile {
  petId: string
  name: string
  species: Species
  color: PetColor
}

export interface Member extends MemberProfile {
  joinedAt: number
  mealsTotal: number
  events: Ev[]
  /** How long the agent waited on its human today, and tasks finished. Absent until the first event. */
  today?: Today
}

export interface BurrowInfo {
  id: string
  name: string
  env: EnvName
  createdAt: number
  createdBy: string
}

export type ServerMsg =
  | { t: 'snapshot'; burrow: BurrowInfo; members: Member[]; serverNow: number }
  | { t: 'event'; petId: string; ev: Ev; today?: Today; serverNow: number }
  | { t: 'member'; member: Member; serverNow: number }
  | { t: 'error'; code: 'not_found' }
  /** Answer to hello: whose pet this browser speaks for, or null if its web token is unknown. */
  | { t: 'welcome'; me: string | null }
  | { t: 'poke'; from: string; to: string; serverNow: number }

export type ClientMsg = { t: 'hello'; token?: string } | { t: 'poke'; to: string }

export const MAX_MEMBER_EVENTS = 50
export const EVENT_RETENTION_MS = 24 * 60 * 60 * 1000
