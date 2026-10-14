import { memberDay, memberWeek, type DayStats, type Member } from '@burrow/core'

export type StatMode = 'today' | 'week'

/** A member's numbers for the viewer's today or the 7 days up to it, from the pet's own days. */
export function statsOf(m: Member, mode: StatMode, todayKey: string): DayStats | undefined {
  return mode === 'week' ? memberWeek(m, todayKey) : memberDay(m, todayKey)
}

/** Members by finished work, then active time; members without stats last. */
export function statRows(members: Member[], mode: StatMode, todayKey: string): Array<{ member: Member; s: DayStats | undefined }> {
  return members
    .map((member) => ({ member, s: statsOf(member, mode, todayKey) }))
    .sort((a, b) => Number(!a.s) - Number(!b.s) || (b.s?.tasks ?? 0) - (a.s?.tasks ?? 0) || (b.s?.activeMs ?? 0) - (a.s?.activeMs ?? 0))
}

export function fmtDur(ms: number): string {
  const m = Math.floor(ms / 60_000)
  const h = Math.floor(m / 60)
  return h ? `${h}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`
}
export const fmtTokens = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n))
export const fmtCost = (n: number) => `$${n.toFixed(2)}`
export const fmtReply = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)}s` : fmtDur(ms))

/** The tag's extra line: how much this pet's agent worked today, if at all. */
export function dayLine(today: Member['today'], todayKey: string): string | null {
  if (!today || today.day !== todayKey || today.activeMs === undefined) return null
  const tasks = today.tasks ?? 0
  if (today.activeMs < 60_000 && !tasks) return null
  return `${fmtDur(today.activeMs)} active · ${tasks} task${tasks === 1 ? '' : 's'}`
}
