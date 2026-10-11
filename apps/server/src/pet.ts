import { DurableObject } from 'cloudflare:workers'
import { emptyLedger, foldWait, parseWireEvent, type Ev, type MemberProfile, type Today, type WaitLedger } from '@burrow/core'
import { allowRate, localDate, sha256Hex, type Hatch } from './logic'

interface Profile extends MemberProfile {
  tz: string
  createdAt: number
}
interface Stats {
  mealsTotal: number
  mealsToday: number
  day: string
  lastEventAt: number | null
}
export type EventResult = { status: 204 } | { status: 400; error: string } | { status: 401 } | { status: 429 }

export class PetDO extends DurableObject<Env> {
  private stamps: number[] = []

  async hatch(petId: string, h: Hatch, secretHash: string, now: number): Promise<MemberProfile> {
    const profile: Profile = { petId, name: h.name, species: h.species, color: h.color, tz: h.tz, createdAt: now }
    await this.ctx.storage.put({
      profile,
      tokens: [secretHash],
      events: [] as Ev[],
      burrows: [] as string[],
      stats: { mealsTotal: 0, mealsToday: 0, day: localDate(now, h.tz), lastEventAt: null } satisfies Stats,
    })
    return { petId, name: profile.name, species: profile.species, color: profile.color }
  }

  /** The pet's public profile if `secret` is its CLI token, else null. */
  async auth(secret: string): Promise<MemberProfile | null> {
    const tokens = (await this.ctx.storage.get<string[]>('tokens')) ?? []
    if (!tokens.includes(await sha256Hex(secret))) return null
    const p = (await this.ctx.storage.get<Profile>('profile'))!
    return { petId: p.petId, name: p.name, species: p.species, color: p.color }
  }

  async addBurrow(burrowId: string): Promise<void> {
    const burrows = (await this.ctx.storage.get<string[]>('burrows')) ?? []
    if (!burrows.includes(burrowId)) await this.ctx.storage.put('burrows', [...burrows, burrowId])
  }

  async event(secret: string, body: unknown, now: number): Promise<EventResult> {
    const tokens = (await this.ctx.storage.get<string[]>('tokens')) ?? []
    if (!tokens.includes(await sha256Hex(secret))) return { status: 401 }
    const rate = allowRate(this.stamps, now, 120, 60_000)
    this.stamps = rate.stamps
    if (!rate.ok) return { status: 429 }
    const parsed = parseWireEvent(body)
    if (!parsed.ok) return { status: 400, error: parsed.error }

    const ev: Ev = { ...parsed.value, t: now }
    const profile = (await this.ctx.storage.get<Profile>('profile'))!
    const stats = (await this.ctx.storage.get<Stats>('stats'))!
    const day = localDate(now, profile.tz)
    if (day !== stats.day) Object.assign(stats, { day, mealsToday: 0 })
    if (ev.type === 'stop') {
      stats.mealsTotal++
      stats.mealsToday++
    }
    stats.lastEventAt = now
    const ledger = foldWait((await this.ctx.storage.get<WaitLedger>('ledger')) ?? emptyLedger(day), ev, day)
    const events = (await this.ctx.storage.get<Ev[]>('events')) ?? []
    events.push(ev)
    await this.ctx.storage.put({ stats, ledger, events: events.filter((e) => e.t > now - 86_400_000).slice(-200) })

    const today: Today = { day, waitedMs: ledger.waitedMs, meals: stats.mealsToday }
    const burrows = (await this.ctx.storage.get<string[]>('burrows')) ?? []
    await Promise.all(burrows.map((id) => this.env.BURROW.get(this.env.BURROW.idFromName(id)).ingest(profile.petId, ev, today)))
    return { status: 204 }
  }
}
