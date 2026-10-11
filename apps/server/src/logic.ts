import {
  cleanName, DEFAULT_COLOR, EVENT_RETENTION_MS, isId, isPetColor, isSpecies, MAX_MEMBER_EVENTS,
  type Ev, type PetColor, type Species,
} from '@burrow/core'

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** `burrowId`: hatch straight into a friend's burrow instead of creating one. */
export type Hatch = { name: string; species: Species; color: PetColor; tz: string; burrowId?: string }

function validTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function validateHatch(body: unknown): { ok: true; value: Hatch } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, error: 'body must be a JSON object' }
  const b = body as Record<string, unknown>
  const name = cleanName(b.name)
  if (!name) return { ok: false, error: 'name: 1-16 letters, digits, spaces, - or _' }
  if (!isSpecies(b.species)) return { ok: false, error: 'species must be mochi, tofu or onigiri' }
  const color = b.color === undefined ? DEFAULT_COLOR[b.species] : b.color
  if (!isPetColor(color)) return { ok: false, error: 'unknown color' }
  const tz = b.tz === undefined ? 'UTC' : b.tz
  if (typeof tz !== 'string' || !validTz(tz)) return { ok: false, error: 'unknown time zone' }
  if (b.burrowId !== undefined && !isId(b.burrowId)) return { ok: false, error: 'burrowId must be a burrow id' }
  return { ok: true, value: { name, species: b.species, color, tz, ...(b.burrowId ? { burrowId: b.burrowId } : {}) } }
}

export function pruneEvents(events: Ev[], now: number): Ev[] {
  return events.filter((e) => e.t > now - EVENT_RETENTION_MS).slice(-MAX_MEMBER_EVENTS)
}

export function allowRate(stamps: number[], now: number, limit: number, windowMs: number): { ok: boolean; stamps: number[] } {
  const recent = stamps.filter((s) => s > now - windowMs)
  if (recent.length >= limit) return { ok: false, stamps: recent }
  return { ok: true, stamps: [...recent, now] }
}

export function localDate(t: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t)
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}
