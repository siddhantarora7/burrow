import { DurableObject } from 'cloudflare:workers'
import { parseWireEvent, type Ev, type MemberProfile } from '@burrow/core'
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
    const events = (await this.ctx.storage.get<Ev[]>('events')) ?? []
    events.push(ev)
    await this.ctx.storage.put({ stats, events: events.filter((e) => e.t > now - 86_400_000).slice(-200) })

    const burrows = (await this.ctx.storage.get<string[]>('burrows')) ?? []
    await Promise.all(burrows.map((id) => this.env.BURROW.get(this.env.BURROW.idFromName(id)).ingest(profile.petId, ev)))
    return { status: 204 }
  }
}
