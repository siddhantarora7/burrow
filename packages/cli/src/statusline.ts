import { derive, growthOf, type Member, type PetState, type Species } from '@burrow/core'
import { FACE } from './ui'

/** The part of Claude Code's status-line JSON burrow reads. */
export interface ClaudeStatus {
  session_id?: string
  cost?: { total_cost_usd?: number }
  rate_limits?: { five_hour?: { used_percentage?: number }; seven_day?: { used_percentage?: number } }
}

/** A garden snapshot as cached on disk; `fetchedAt` is this machine's clock when it arrived. */
export interface GardenSnap {
  members: Member[]
  serverNow: number
  fetchedAt: number
}

const WORD: Record<PetState, string> = { idle: 'hanging out', eat: 'eating', wave: 'needs you', work: 'working', sleep: 'asleep', cheer: 'cheering' }

export function fmtDur(ms: number): string {
  const m = Math.floor(ms / 60_000)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

const paint = (on: boolean) => (code: string, s: string) => (on ? `\x1b[${code}m${s}\x1b[0m` : s)

/** One line about you, and a second only when a friend's agent is waiting on them. */
export function statusLines(o: { claude: ClaudeStatus; me: { petId: string; name: string; species: Species }; snap: GardenSnap | null; now: number; color: boolean }): string[] {
  const c = paint(o.color)
  const sep = c('2', ' · ')
  // derive runs on server time; the cache knows how far this clock was from it
  const serverNow = o.snap ? o.now + (o.snap.serverNow - o.snap.fetchedAt) : o.now
  const stateOf = (m: Member) => {
    const d = derive({ events: m.events, now: serverNow })
    return d.quiet ? 'quiet' : WORD[d.state]
  }
  const mine = o.snap?.members.find((m) => m.petId === o.me.petId)

  const head = `${c('38;5;211', FACE[o.me.species])} ${c('1', o.me.name)}`
  const parts: string[] = []
  if (mine) {
    const word = stateOf(mine)
    parts.push(word === 'needs you' ? c('1;33', word) : word === 'working' ? c('32', word) : word)
  }
  const bits: string[] = []
  if (mine) {
    bits.push(c('33', `🪙 ${growthOf(mine).koban}`))
    const t = mine.today
    if (t?.activeMs !== undefined) bits.push(`${fmtDur(t.activeMs)} active`)
    if (t) bits.push(`waited ${fmtDur(t.waitedMs)}`)
  }
  const shared = mine?.today?.costUsd
  const session = o.claude.cost?.total_cost_usd
  if (shared !== undefined) bits.push(c('33', `$${shared.toFixed(2)} today`))
  else if (session !== undefined) bits.push(c('33', `$${session.toFixed(2)} session`))
  const five = o.claude.rate_limits?.five_hour?.used_percentage
  const seven = o.claude.rate_limits?.seven_day?.used_percentage
  if (five !== undefined) bits.push(c('2', `5h ${Math.round(five)}%`))
  if (seven !== undefined) bits.push(c('2', `7d ${Math.round(seven)}%`))
  const lines = [[`${head}${parts.length ? ` ${parts.join('')}` : ''}`, ...bits].join(sep)]

  const friends = (o.snap?.members ?? []).filter((m) => m.petId !== o.me.petId)
  const waiting = friends.filter((m) => derive({ events: m.events, now: serverNow }).state === 'wave')
  if (waiting.length) {
    const since = (m: Member) => {
      const asked = [...m.events].reverse().find((e) => e.type === 'needs_input' || e.type === 'error')
      return asked ? fmtDur(serverNow - asked.t) : ''
    }
    const rest = friends.filter((m) => !waiting.includes(m))
    const shown = [...waiting.map((m) => c('1;33', `${m.name} waiting ${since(m)}`.trim())), ...rest.slice(0, 4).map((m) => `${m.name} ${stateOf(m)}`)]
    if (rest.length > 4) shown.push(c('2', `+${rest.length - 4}`))
    lines.push(shown.join(sep))
  }
  return lines
}
