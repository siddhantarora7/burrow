import { DurableObject } from 'cloudflare:workers'
import { canPoke, isCareAction, MAX_MEMBERS, parseToken, type BurrowInfo, type CareAction, type ClientMsg, type Ev, type Member, type MemberProfile, type PetGrowth, type ServerMsg, type Today, type DayStats } from '@burrow/core'
import { pruneEvents, renamed, withForms } from './logic'

export class BurrowDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // Keepalive pings are answered without waking the object.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  async create(info: BurrowInfo): Promise<void> {
    await this.ctx.storage.put({ info, members: [] as Member[] })
  }

  async exists(): Promise<boolean> {
    return (await this.ctx.storage.get<BurrowInfo>('info')) !== undefined
  }

  /** Idempotent: a pet that already lives here is `ok`. */
  async join(profile: MemberProfile, now: number): Promise<'ok' | 'not_found' | 'full'> {
    if (!(await this.exists())) return 'not_found'
    const members = (await this.ctx.storage.get<Member[]>('members')) ?? []
    if (members.some((m) => m.petId === profile.petId)) return 'ok'
    if (members.length >= MAX_MEMBERS) return 'full'
    const member: Member = { ...profile, joinedAt: now, mealsTotal: 0, events: [] }
    await this.ctx.storage.put({ members: [...members, member], catalog: await this.catalogWith([member]) })
    this.broadcast({ t: 'member', member, serverNow: now })
    return 'ok'
  }

  async info(): Promise<BurrowInfo | null> {
    return (await this.ctx.storage.get<BurrowInfo>('info')) ?? null
  }

  async isFull(): Promise<boolean> {
    return ((await this.ctx.storage.get<Member[]>('members')) ?? []).length >= MAX_MEMBERS
  }

  async ingest(petId: string, ev: Ev, today?: Today, growth?: PetGrowth, days?: DayStats[]): Promise<void> {
    const members = (await this.ctx.storage.get<Member[]>('members')) ?? []
    const m = members.find((x) => x.petId === petId)
    if (!m) return
    m.events = pruneEvents([...m.events, ev], ev.t)
    if (ev.type === 'stop') m.mealsTotal++
    if (today) m.today = today
    if (growth) m.growth = growth
    if (days) m.days = days
    await this.ctx.storage.put({ members, catalog: await this.catalogWith([m]) })
    // The Worker that stamped ev.t may run on a machine whose clock is slightly ahead of this one.
    this.broadcast({ t: 'event', petId, ev, today, days, growth, serverNow: Math.max(Date.now(), ev.t) })
  }

  /** A member took a new name: store it (and the garden's, if it was named after the founder) and tell every page. */
  async rename(petId: string, name: string, now: number): Promise<void> {
    const info = await this.info()
    if (!info) return
    const r = renamed((await this.ctx.storage.get<Member[]>('members')) ?? [], info, petId, name)
    if (!r.changed) return
    await this.ctx.storage.put({ members: r.members, info: r.info })
    this.broadcast({ t: 'rename', petId, name, ...(r.info.name !== info.name ? { burrowName: r.info.name } : {}), serverNow: now })
  }

  /** A member's owner fed or played with it (PetDO already charged the koban). */
  async grow(petId: string, growth: PetGrowth, effect: CareAction, now: number): Promise<void> {
    const members = (await this.ctx.storage.get<Member[]>('members')) ?? []
    const m = members.find((x) => x.petId === petId)
    if (!m) return
    m.growth = growth
    await this.ctx.storage.put({ members, catalog: await this.catalogWith([m]) })
    this.broadcast({ t: 'grow', petId, growth, effect, serverNow: now })
  }

  /** What a page's snapshot holds, for the CLI's status line and stats table. Null if there is no such burrow. */
  async snapshotJson(now: number): Promise<Extract<ServerMsg, { t: 'snapshot' }> | null> {
    const info = await this.info()
    if (!info) return null
    const members = ((await this.ctx.storage.get<Member[]>('members')) ?? []).map((m) => ({ ...m, events: pruneEvents(m.events, now) }))
    return { t: 'snapshot', burrow: info, members, catalog: await this.catalogWith(members), serverNow: now }
  }

  /** The stored catalog plus these members' current forms. It only ever grows. */
  private async catalogWith(members: Member[]): Promise<string[]> {
    return withForms((await this.ctx.storage.get<string[]>('catalog')) ?? [], members)
  }

  override async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected a websocket', { status: 426 })
    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]
    this.ctx.acceptWebSocket(server)
    const info = await this.ctx.storage.get<BurrowInfo>('info')
    if (!info) {
      server.send(JSON.stringify({ t: 'error', code: 'not_found' } satisfies ServerMsg))
      server.close(4404, 'burrow not found')
    } else {
      const now = Date.now()
      const members = ((await this.ctx.storage.get<Member[]>('members')) ?? []).map((m) => ({ ...m, events: pruneEvents(m.events, now) }))
      // gardens from before the catalog existed start with their members' forms
      server.send(JSON.stringify({ t: 'snapshot', burrow: info, members, catalog: await this.catalogWith(members), serverNow: now } satisfies ServerMsg))
    }
    return new Response(null, { status: 101, webSocket: client })
  }

  override async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    let msg: ClientMsg
    try {
      msg = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data)) as ClientMsg
    } catch {
      return
    }
    if (msg.t === 'hello') {
      // A web token proves which pet this browser speaks for; the attachment survives hibernation.
      const tok = parseToken(msg.token)
      const me = tok && (await this.env.PET.get(this.env.PET.idFromName(tok.petId)).checkWeb(tok.secret)) ? tok.petId : null
      ws.serializeAttachment({ me })
      ws.send(JSON.stringify({ t: 'welcome', me } satisfies ServerMsg))
      return
    }
    if (msg.t === 'poke' && typeof msg.to === 'string') {
      const from = (ws.deserializeAttachment() as { me?: string | null } | null)?.me ?? null
      const now = Date.now()
      const members = (await this.ctx.storage.get<Member[]>('members')) ?? []
      const pokes = (await this.ctx.storage.get<Record<string, number>>('pokes')) ?? {}
      const key = `${from}>${msg.to}`
      if (!canPoke({ from, to: msg.to, members, now, lastPokeAt: pokes[key] })) return
      // keep only recent entries so the map stays small
      const fresh = Object.fromEntries(Object.entries(pokes).filter(([, t]) => now - t < 60_000))
      await this.ctx.storage.put('pokes', { ...fresh, [key]: now })
      this.broadcast({ t: 'poke', from: from!, to: msg.to, serverNow: now })
      return
    }
    if (msg.t === 'care' && isCareAction(msg.action)) {
      // only a browser signed in as a member, and only for its own pet; PetDO charges and tells every garden
      const me = (ws.deserializeAttachment() as { me?: string | null } | null)?.me ?? null
      const members = (await this.ctx.storage.get<Member[]>('members')) ?? []
      if (!me || !members.some((m) => m.petId === me)) return
      await this.env.PET.get(this.env.PET.idFromName(me)).care(msg.action, Date.now())
    }
    if (msg.t === 'rename' && typeof msg.name === 'string') {
      // same rule as care: a signed-in member renames only its own pet; PetDO tells every garden
      const me = (ws.deserializeAttachment() as { me?: string | null } | null)?.me ?? null
      const members = (await this.ctx.storage.get<Member[]>('members')) ?? []
      if (!me || !members.some((m) => m.petId === me)) return
      await this.env.PET.get(this.env.PET.idFromName(me)).renameFromPage(msg.name, Date.now())
    }
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye')
    } catch {
      // already closed
    }
  }

  private broadcast(msg: ServerMsg): void {
    const s = JSON.stringify(msg)
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(s)
      } catch {
        // socket went away; the runtime cleans it up
      }
    }
  }
}
