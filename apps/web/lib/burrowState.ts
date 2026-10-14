import { MAX_MEMBER_EVENTS, type BurrowInfo, type CareAction, type Member, type ServerMsg } from '@burrow/core'

export type Status = 'connecting' | 'live' | 'reconnecting' | 'not_found'

export interface BurrowState {
  status: Status
  burrow: BurrowInfo | null
  members: Member[]
  /** serverNow - clientNow at the last message: add to Date.now() to get server time. */
  offset: number
  /** The pet this browser speaks for, once the server has welcomed its web token. */
  me: string | null
  /** Recent pokes, newest last; `t` is server time. */
  pokes: Array<{ from: string; to: string; t: number }>
  /** Forms this garden has found (`species:stage`), as the server last said; see discovered(). */
  catalog: string[]
  /** Recent feeds and plays, newest last; `t` is server time. */
  cares: Array<{ petId: string; effect: CareAction; t: number }>
}

export const initialState: BurrowState = { status: 'connecting', burrow: null, members: [], offset: 0, me: null, pokes: [], catalog: [], cares: [] }

export type Action = { kind: 'msg'; msg: ServerMsg; clientNow: number } | { kind: 'status'; status: Status }

export function reduce(state: BurrowState, action: Action): BurrowState {
  if (action.kind === 'status') return state.status === 'not_found' ? state : { ...state, status: action.status }
  const { msg, clientNow } = action
  switch (msg.t) {
    case 'snapshot':
      return { ...state, status: 'live', burrow: msg.burrow, members: msg.members, catalog: msg.catalog ?? [], offset: msg.serverNow - clientNow }
    case 'member':
      if (state.members.some((m) => m.petId === msg.member.petId)) return state
      return { ...state, members: [...state.members, msg.member], offset: msg.serverNow - clientNow }
    case 'event': {
      if (!state.members.some((m) => m.petId === msg.petId)) return state
      const members = state.members.map((m) =>
        m.petId !== msg.petId
          ? m
          : {
              ...m,
              events: [...m.events, msg.ev].slice(-MAX_MEMBER_EVENTS),
              mealsTotal: m.mealsTotal + (msg.ev.type === 'stop' ? 1 : 0),
              ...(msg.today ? { today: msg.today } : {}),
              ...(msg.week ? { week: msg.week } : {}),
              ...(msg.growth ? { growth: msg.growth } : {}),
            },
      )
      return { ...state, members, offset: msg.serverNow - clientNow }
    }
    case 'error':
      return { ...initialState, status: 'not_found' }
    case 'welcome':
      return { ...state, me: msg.me }
    case 'poke':
      return { ...state, pokes: [...state.pokes, { from: msg.from, to: msg.to, t: msg.serverNow }].slice(-10) }
    case 'grow':
      if (!state.members.some((m) => m.petId === msg.petId)) return state
      return {
        ...state,
        members: state.members.map((m) => (m.petId === msg.petId ? { ...m, growth: msg.growth } : m)),
        cares: [...state.cares, { petId: msg.petId, effect: msg.effect, t: msg.serverNow }].slice(-10),
        offset: msg.serverNow - clientNow,
      }
  }
}
