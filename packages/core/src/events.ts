export const EVENT_TYPES = ['session_start', 'prompt', 'heartbeat', 'needs_input', 'stop', 'error', 'session_end'] as const
export type EventType = (typeof EVENT_TYPES)[number]

/** Exactly what a hook sends. Nothing else is ever accepted. */
export interface WireEvent {
  v: 1
  type: EventType
  at: number
  session: string
}

/** A stored event: the wire event plus the server's receive time `t`. */
export interface Ev extends WireEvent {
  t: number
}

const WIRE_KEYS: readonly string[] = ['v', 'type', 'at', 'session']
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
  return { ok: true, value: { v: 1, type: b.type, at: b.at, session: b.session } }
}
