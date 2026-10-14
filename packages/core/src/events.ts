export const EVENT_TYPES = ['session_start', 'prompt', 'heartbeat', 'needs_input', 'stop', 'error', 'session_end'] as const
export type EventType = (typeof EVENT_TYPES)[number]

/** Token and cost increases since the pet's last event, sent only by owners who turned usage sharing on. */
export interface WireUsage {
  tokens?: number
  cost?: number
}

/** Exactly what a hook sends. Nothing else is ever accepted. */
export interface WireEvent {
  v: 1
  type: EventType
  at: number
  session: string
  /** Opt-in, and only on stop or session_end. */
  usage?: WireUsage
}

/** A stored event: the wire event plus the server's receive time `t`. */
export interface Ev extends WireEvent {
  t: number
}

const WIRE_KEYS: readonly string[] = ['v', 'type', 'at', 'session', 'usage']
const USAGE_TYPES: readonly string[] = ['stop', 'session_end']
const SESSION_RE = /^[0-9a-f]{12}$/

export type ParseResult = { ok: true; value: WireEvent } | { ok: false; error: string }

export function isEventType(x: unknown): x is EventType {
  return typeof x === 'string' && (EVENT_TYPES as readonly string[]).includes(x)
}

export function parseWireEvent(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' }
  }
  const extra = Object.keys(body).filter((k) => !WIRE_KEYS.includes(k))
  if (extra.length) return { ok: false, error: `unexpected keys: ${extra.join(', ')}` }
  const b = body as Record<string, unknown>
  if (b.v !== 1) return { ok: false, error: 'v must be 1' }
  if (!isEventType(b.type)) return { ok: false, error: 'unknown type' }
  if (typeof b.at !== 'number' || !Number.isSafeInteger(b.at) || b.at <= 0) {
    return { ok: false, error: 'at must be epoch ms' }
  }
  if (typeof b.session !== 'string' || !SESSION_RE.test(b.session)) {
    return { ok: false, error: 'session must be 12 hex chars' }
  }
  const value: WireEvent = { v: 1, type: b.type, at: b.at, session: b.session }
  if ('usage' in b) {
    const u = parseUsage(b.usage, b.type)
    if (typeof u === 'string') return { ok: false, error: u }
    value.usage = u
  }
  return { ok: true, value }
}

function parseUsage(u: unknown, type: EventType): WireUsage | string {
  if (!USAGE_TYPES.includes(type)) return 'usage only on stop or session_end'
  if (typeof u !== 'object' || u === null || Array.isArray(u) || Object.keys(u).some((k) => k !== 'tokens' && k !== 'cost')) {
    return 'usage takes only tokens and cost'
  }
  const o = u as Record<string, unknown>
  const out: WireUsage = {}
  if ('tokens' in o) {
    if (typeof o.tokens !== 'number' || !Number.isSafeInteger(o.tokens) || o.tokens < 0 || o.tokens > 50_000_000) return 'usage.tokens must be an integer up to 50M'
    out.tokens = o.tokens
  }
  if ('cost' in o) {
    if (typeof o.cost !== 'number' || !Number.isFinite(o.cost) || o.cost < 0 || o.cost > 500) return 'usage.cost must be 0 to 500'
    out.cost = o.cost
  }
  return out
}
