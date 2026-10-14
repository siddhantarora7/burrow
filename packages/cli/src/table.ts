import { derive, memberDay, memberWeek, type DayStats, type Member } from '@burrow/core'
import { fmtDur } from './statusline'

const BLOCKS = '▁▂▃▄▅▆▇█'

/** One block per value, scaled so `max` is the tallest. */
export function spark(values: number[], max: number): string {
  return values.map((v) => BLOCKS[max > 0 ? Math.round((v / max) * (BLOCKS.length - 1)) : 0]).join('')
}

const fmtTokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n))
const fmtReply = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)}s` : fmtDur(ms))

/** The garden's day or week as a plain table, sorted by finished work rather than spend. */
export function statsTable(o: { burrowName: string; members: Member[]; me: string; week: boolean; webUrl: string; burrowId: string; color: boolean; now: number; todayKey: string }): string {
  const c = (code: string, s: string) => (o.color ? `\x1b[${code}m${s}\x1b[0m` : s)
  const pick = (m: Member): DayStats | undefined => (o.week ? memberWeek(m, o.todayKey) : memberDay(m, o.todayKey))
  const rows = o.members
    .map((m) => ({ m, s: pick(m) }))
    .sort((a, b) => (b.s?.tasks ?? 0) - (a.s?.tasks ?? 0) || (b.s?.activeMs ?? 0) - (a.s?.activeMs ?? 0))
  const waiting = o.members.filter((m) => derive({ events: m.events, now: o.now }).state === 'wave').length

  const head = ['#', 'name', 'active', 'tasks', 'turns', 'waited', 'replies', 'tokens', 'cost']
  const cells = rows.map(({ m, s }, i) => [
    `${m.petId === o.me ? '→' : ''}${i + 1}`,
    m.name,
    fmtDur(s?.activeMs ?? 0),
    String(s?.tasks ?? 0),
    String(s?.turns ?? 0),
    s ? fmtDur(s.waitedMs) : '–',
    s?.replies ? fmtReply(s.replyMs / s.replies) : '–',
    s?.tokens !== undefined ? fmtTokens(s.tokens) : '–',
    s?.costUsd !== undefined ? `$${s.costUsd.toFixed(2)}` : '–',
  ])
  const width = head.map((h, i) => Math.max(h.length, ...cells.map((r) => r[i]!.length)))
  const line = (r: string[]) => `  ${r.map((v, i) => (i === 0 ? v.padStart(width[0]!) : v.padEnd(width[i]!))).join('  ').trimEnd()}`

  const out = [
    '',
    `  ${c('1', o.burrowName)} · ${o.week ? 'this week' : 'today'} · ${o.members.length} member${o.members.length === 1 ? '' : 's'}${waiting ? c('33', ` · ${waiting} waiting`) : ''}`,
    '',
    c('2', line(head)),
    ...cells.map((r, i) => (rows[i]!.m.petId === o.me ? c('1', line(r)) : line(r))),
  ]
  const active = rows.filter(({ s }) => s && s.activeMs > 0)
  if (active.length) {
    const max = Math.max(...active.flatMap(({ s }) => s!.hourMs))
    const pad = Math.max(...active.map(({ m }) => m.name.length))
    out.push('', c('2', `  activity (24h)`), ...active.map(({ m, s }) => `  ${m.name.padEnd(pad)}  ${c('38;5;180', spark(s!.hourMs, max))}`))
  }
  const link = `${o.webUrl}/b/${o.burrowId}`
  out.push('', `  ${c('2', 'garden')}  ${link}`, `  ${c('2', 'invite')}  npx burrow-pets init ${link}`, '')
  return out.join('\n')
}
