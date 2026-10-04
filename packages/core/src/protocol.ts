import type { Ev } from './events'
import type { PetColor, Species } from './species'

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
  | { t: 'event'; petId: string; ev: Ev; serverNow: number }
  | { t: 'member'; member: Member; serverNow: number }
  | { t: 'error'; code: 'not_found' }

export type ClientMsg = { t: 'hello' }

export const MAX_MEMBER_EVENTS = 50
export const EVENT_RETENTION_MS = 24 * 60 * 60 * 1000
