import type { PetState } from '@burrow/core'

// When to alert you. Pure, so the rules are tested; useAlerts does the sound and the notification.
export interface Alert { kind: 'wave' | 'poke'; title: string; body: string }

const BODY = 'your agent is waiting on you'

/** Your own pet starting to wave. Nothing on the first observation, so a reload never alerts. */
export function alertsFor(prev: ReadonlyMap<string, PetState> | null, next: ReadonlyMap<string, PetState>, me: string | null, names: ReadonlyMap<string, string>): Alert[] {
  if (!prev || !me) return []
  if (next.get(me) !== 'wave' || prev.get(me) === 'wave') return []
  return [{ kind: 'wave', title: `${names.get(me) ?? 'your pet'} needs you`, body: BODY }]
}

/** Pokes at you newer than `since` (server time). */
export function pokeAlerts(pokes: ReadonlyArray<{ from: string; to: string; t: number }>, me: string | null, since: number, names: ReadonlyMap<string, string>): Alert[] {
  if (!me) return []
  return pokes.filter((p) => p.to === me && p.t > since).map((p) => ({ kind: 'poke', title: `${names.get(p.from) ?? 'a friend'} poked you`, body: BODY }))
}

/**
 * The alerts chip. Browsers keep sound locked until the page is clicked, and a second-screen tab is
 * often reloaded and never touched, so a locked chime is said out loud rather than failing silently.
 */
export function alertChip({ on, permission, soundReady }: { on: boolean; permission: NotificationPermission; soundReady: boolean }): 'alerts off' | 'click for sound' | 'allow notifications' | 'chime only' | 'alerts on' {
  if (!on) return 'alerts off'
  if (!soundReady) return 'click for sound'
  // never asked yet: say what pressing does, not that notifications were refused
  return permission === 'granted' ? 'alerts on' : permission === 'default' ? 'allow notifications' : 'chime only'
}
