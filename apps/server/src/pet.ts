import { DurableObject } from 'cloudflare:workers'
import { care, CLAIM_TTL_MS, earn, runLength, emptyBook, emptyLedger, foldStats, foldWait, type StatsBook, LEGACY_XP, newGrowth, newId, parseWireEvent, publicGrowth, SECRET_LEN, type CareAction, type Ev, type Growth, type MemberProfile, type PetGrowth, type Today, type WaitLedger } from '@burrow/core'
import { allowRate, capList, CLAIM_CODE_LEN, localDate, localHour, pruneClaims, sha256Hex, type Claim, type Hatch } from './logic'

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
  private redeemStamps: number[] = []
  private careStamps: number[] = []

  /** Stored growth; a pet hatched before growth existed starts grown. */
  private async loadGrowth(now: number): Promise<Growth> {
    const g = await this.ctx.storage.get<Growth>('growth')
    if (g) return g
    const p = (await this.ctx.storage.get<Profile>('profile'))!
    return newGrowth(localDate(now, p.tz), LEGACY_XP)
  }

  async hatch(petId: string, h: Hatch, secretHash: string, now: number): Promise<MemberProfile> {
    const profile: Profile = { petId, name: h.name, species: h.species, color: h.color, tz: h.tz, createdAt: now }
    const growth = newGrowth(localDate(now, h.tz))
    await this.ctx.storage.put({
      growth,
      profile,
      tokens: [secretHash],
      events: [] as Ev[],
      burrows: [] as string[],
      stats: { mealsTotal: 0, mealsToday: 0, day: localDate(now, h.tz), lastEventAt: null } satisfies Stats,
    })
    return { petId, name: profile.name, species: profile.species, color: profile.color, growth: publicGrowth(growth) }
  }

  /** The pet's public profile if `secret` is its CLI token, else null. */
  async auth(secret: string): Promise<MemberProfile | null> {
    const tokens = (await this.ctx.storage.get<string[]>('tokens')) ?? []
    if (!tokens.includes(await sha256Hex(secret))) return null
    const p = (await this.ctx.storage.get<Profile>('profile'))!
    return { petId: p.petId, name: p.name, species: p.species, color: p.color, growth: publicGrowth(await this.loadGrowth(Date.now())) }
  }

  /** A one-time browser sign-in, valid for 10 minutes: `<petId>.<code>`. Only its hash is kept. */
  async newClaim(now: number): Promise<string> {
    const p = (await this.ctx.storage.get<Profile>('profile'))!
    const code = newId(CLAIM_CODE_LEN)
    const claims = pruneClaims((await this.ctx.storage.get<Claim[]>('claims')) ?? [], now)
    await this.ctx.storage.put('claims', capList([...claims, { hash: await sha256Hex(code), exp: now + CLAIM_TTL_MS }], 5))
    return `${p.petId}.${code}`
  }

  /** Spends a claim once and mints a web token, which can say hello and poke but never post events. */
  async redeem(code: string, now: number): Promise<{ token: string } | null> {
    const rate = allowRate(this.redeemStamps, now, 10, 60_000)
    this.redeemStamps = rate.stamps
    if (!rate.ok) return null
    const claims = pruneClaims((await this.ctx.storage.get<Claim[]>('claims')) ?? [], now)
    const hash = await sha256Hex(code)
    if (!claims.some((c) => c.hash === hash)) return null
    const p = await this.ctx.storage.get<Profile>('profile')
    if (!p) return null
    const secret = newId(SECRET_LEN)
    const web = (await this.ctx.storage.get<string[]>('webTokens')) ?? []
    await this.ctx.storage.put({ claims: claims.filter((c) => c.hash !== hash), webTokens: capList([...web, await sha256Hex(secret)], 10) })
    return { token: `${p.petId}.${secret}` }
  }

  async checkWeb(secret: string): Promise<boolean> {
    return ((await this.ctx.storage.get<string[]>('webTokens')) ?? []).includes(await sha256Hex(secret))
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

    // usage feeds the stats book only; stored and broadcast events never carry it
    const { usage, ...wire } = parsed.value
    const ev: Ev = { ...wire, t: now }
    const profile = (await this.ctx.storage.get<Profile>('profile'))!
    const stats = (await this.ctx.storage.get<Stats>('stats'))!
    const day = localDate(now, profile.tz)
    if (day !== stats.day) Object.assign(stats, { day, mealsToday: 0 })
    if (ev.type === 'stop') {
      stats.mealsTotal++
      stats.mealsToday++
    }
    stats.lastEventAt = now
    // earn() reads the ledger from before this event: a reply's wait is ev.t minus when it opened
    const prev = (await this.ctx.storage.get<WaitLedger>('ledger')) ?? emptyLedger(day)
    const events = (await this.ctx.storage.get<Ev[]>('events')) ?? []
    const runMs = runLength(events, ev)
    const growth = earn(await this.loadGrowth(now), prev, ev, day, runMs)
    const ledger = foldWait(prev, ev, day)
    const book = foldStats((await this.ctx.storage.get<StatsBook>('book')) ?? emptyBook(), ev, {
      day, hour: localHour(now, profile.tz), prev, runMs: runMs ?? 0, waitedMs: ledger.waitedMs, meals: stats.mealsToday, usage,
    })
    events.push(ev)
    await this.ctx.storage.put({ stats, ledger, growth, book, events: events.filter((e) => e.t > now - 86_400_000).slice(-200) })

    const today: Today = book.days.at(-1)!
    const burrows = (await this.ctx.storage.get<string[]>('burrows')) ?? []
    await Promise.all(burrows.map((id) => this.env.BURROW.get(this.env.BURROW.idFromName(id)).ingest(profile.petId, ev, today, publicGrowth(growth), book.days)))
    return { status: 204 }
  }

  /** Feed or play, paid in koban; every garden the pet lives in sees it. Null without enough koban. */
  async care(action: CareAction, now: number): Promise<PetGrowth | null> {
    const rate = allowRate(this.careStamps, now, 30, 60_000)
    this.careStamps = rate.stamps
    if (!rate.ok) return null
    const next = care(await this.loadGrowth(now), action)
    if (!next) return null
    await this.ctx.storage.put('growth', next)
    const growth = publicGrowth(next)
    const p = (await this.ctx.storage.get<Profile>('profile'))!
    const burrows = (await this.ctx.storage.get<string[]>('burrows')) ?? []
    await Promise.all(burrows.map((id) => this.env.BURROW.get(this.env.BURROW.idFromName(id)).grow(p.petId, growth, action, now)))
    return growth
  }
}
