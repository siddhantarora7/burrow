import { formKey, growthOf, STAGES, stageOf, type CareAction, type Member, type PetState, type Stage } from '@burrow/core'

/** Every form this garden has found: what the server remembers plus what its members are now. */
export function discovered(catalog: readonly string[], members: readonly Member[]): Set<string> {
  return new Set([...catalog, ...members.map((m) => formKey(m.species, stageOf(growthOf(m).xp)))])
}

export interface Rank {
  member: Member
  weekKoban: number
  stage: Stage
  xp: number
}

/**
 * This week's garden leaderboard: koban earned this week, then xp. A member whose koban belong to an older
 * week than the newest one here counts zero (pets in other timezones roll over at their own midnight).
 */
export function ranks(members: readonly Member[]): Rank[] {
  const week = members.reduce((w, m) => (growthOf(m).week > w ? growthOf(m).week : w), '')
  return members
    .map((member) => {
      const g = growthOf(member)
      return { member, weekKoban: g.week === week ? g.weekKoban : 0, stage: stageOf(g.xp), xp: g.xp }
    })
    .sort((a, b) => b.weekKoban - a.weekKoban || b.xp - a.xp)
}

const CARE_ANIM: Record<CareAction, { state: PetState; ms: number }> = { feed: { state: 'eat', ms: 2400 }, play: { state: 'cheer', ms: 2000 } }

/** The animation a recent feed or play puts on this pet at server time `now`, or null. */
export function careState(cares: ReadonlyArray<{ petId: string; effect: CareAction; t: number }>, petId: string, now: number): PetState | null {
  const last = cares.filter((c) => c.petId === petId).at(-1)
  if (!last) return null
  const a = CARE_ANIM[last.effect]
  return now - last.t <= a.ms ? a.state : null
}

/** Pets whose stage went up since `prev` (null on first sight: loading a garden never celebrates). */
export function stageRises(prev: ReadonlyMap<string, Stage> | null, members: readonly Member[]) {
  const stages = new Map(members.map((m) => [m.petId, stageOf(growthOf(m).xp)] as const))
  const rises = prev
    ? members.flatMap((m) => {
        const before = prev.get(m.petId), now = stages.get(m.petId)!
        return before && STAGES.indexOf(now) > STAGES.indexOf(before) ? [{ petId: m.petId, name: m.name, stage: now }] : []
      })
    : []
  return { rises, stages }
}

/** Pets whose koban went up since `prev`, for the little "+3" over their heads. Spending and first sight are silent. */
export function kobanGains(prev: ReadonlyMap<string, number> | null, members: readonly Member[]) {
  const balances = new Map(members.map((m) => [m.petId, growthOf(m).koban] as const))
  const gains = prev
    ? members.flatMap((m) => {
        const before = prev.get(m.petId), now = balances.get(m.petId)!
        return before !== undefined && now > before ? [{ petId: m.petId, amount: now - before }] : []
      })
    : []
  return { gains, balances }
}
