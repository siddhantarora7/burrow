import { MAX_MEMBER_EVENTS, type BurrowInfo, type Member, type ServerMsg } from '@burrow/core'

export type Status = 'connecting' | 'live' | 'reconnecting' | 'not_found'

export interface BurrowState {
  status: Status
  burrow: BurrowInfo | null
  members: Member[]
  /** serverNow - clientNow at the last message: add to Date.now() to get server time. */
  offset: number
}

export const initialState: BurrowState = { status: 'connecting', burrow: null, members: [], offset: 0 }

export type Action = { kind: 'msg'; msg: ServerMsg; clientNow: number } | { kind: 'status'; status: Status }

export function reduce(state: BurrowState, action: Action): BurrowState {
  if (action.kind === 'status') return state.status === 'not_found' ? state : { ...state, status: action.status }
  const { msg, clientNow } = action
  switch (msg.t) {
    case 'snapshot':
      return { status: 'live', burrow: msg.burrow, members: msg.members, offset: msg.serverNow - clientNow }
    case 'member':
      if (state.members.some((m) => m.petId === msg.member.petId)) return state
      return { ...state, members: [...state.members, msg.member], offset: msg.serverNow - clientNow }
    case 'event': {
      if (!state.members.some((m) => m.petId === msg.petId)) return state
      const members = state.members.map((m) =>
        m.petId !== msg.petId
          ? m
          : { ...m, events: [...m.events, msg.ev].slice(-MAX_MEMBER_EVENTS), mealsTotal: m.mealsTotal + (msg.ev.type === 'stop' ? 1 : 0) },
      )
      return { ...state, members, offset: msg.serverNow - clientNow }
    }
    case 'error':
      return { ...initialState, status: 'not_found' }
    case 'welcome':
    case 'poke':
      return state
  }
}
