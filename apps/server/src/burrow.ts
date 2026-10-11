import { DurableObject } from 'cloudflare:workers'
import { canPoke, MAX_MEMBERS, parseToken, type BurrowInfo, type ClientMsg, type Ev, type Member, type MemberProfile, type ServerMsg, type Today } from '@burrow/core'
import { pruneEvents } from './logic'

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
    await this.ctx.storage.put('members', [...members, member])
    this.broadcast({ t: 'member', member, serverNow: now })
    return 'ok'
  }

  async info(): Promise<BurrowInfo | null> {
    return (await this.ctx.storage.get<BurrowInfo>('info')) ?? null
  }

  async isFull(): Promise<boolean> {
    return ((await this.ctx.storage.get<Member[]>('members')) ?? []).length >= MAX_MEMBERS
  }

  async ingest(petId: string, ev: Ev, today?: Today): Promise<void> {
    const members = (await this.ctx.storage.get<Member[]>('members')) ?? []
    const m = members.find((x) => x.petId === petId)
    if (!m) return
    m.events = pruneEvents([...m.events, ev], ev.t)
    if (ev.type === 'stop') m.mealsTotal++
    if (today) m.today = today
    await this.ctx.storage.put('members', members)
    // The Worker that stamped ev.t may run on a machine whose clock is slightly ahead of this one.
    this.broadcast({ t: 'event', petId, ev, today, serverNow: Math.max(Date.now(), ev.t) })
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
      server.send(JSON.stringify({ t: 'snapshot', burrow: info, members, serverNow: now } satisfies ServerMsg))
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
