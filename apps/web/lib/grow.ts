import { formKey, growthOf, stageOf, type Member, type Stage } from '@burrow/core'

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
