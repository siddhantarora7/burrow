import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { EventType, WireEvent } from '@burrow/core'
import { burrowHome, readConfig } from './config'

export const HOOK_ARGS = ['session_start', 'prompt', 'heartbeat', 'notify', 'stop', 'error', 'session_end'] as const
export type HookArg = (typeof HOOK_ARGS)[number]

export interface HookInput {
  session_id?: string
  notification_type?: string
}

export interface LastSent {
  type: EventType
  at: number
}

export const HEARTBEAT_MIN_MS = 60_000
const NEEDS_INPUT = new Set(['permission_prompt', 'agent_needs_input', 'elicitation_dialog'])
const PASS_THROUGH = new Set<string>(['session_start', 'prompt', 'heartbeat', 'stop', 'error', 'session_end'])

/** Keep two fields from Claude's hook JSON. Everything else is dropped here and never stored. */
export function pickInput(raw: string): HookInput {
  let j: unknown
  try {
    j = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof j !== 'object' || j === null || Array.isArray(j)) return {}
  const o = j as Record<string, unknown>
  const out: HookInput = {}
  if (typeof o.session_id === 'string') out.session_id = o.session_id
  if (typeof o.notification_type === 'string') out.notification_type = o.notification_type
  return out
}

export function eventTypeFor(arg: string, input: HookInput): EventType | null {
  if (arg === 'notify') return input.notification_type && NEEDS_INPUT.has(input.notification_type) ? 'needs_input' : null
  return PASS_THROUGH.has(arg) ? (arg as EventType) : null
}

export function sessionHash(salt: string, sessionId: string): string {
  return createHash('sha256').update(salt + sessionId).digest('hex').slice(0, 12)
}

export function shouldSend(type: EventType, last: LastSent | null, now: number): boolean {
  if (type !== 'heartbeat' || !last || last.type !== 'heartbeat') return true
  return now - last.at >= HEARTBEAT_MIN_MS
}

async function readLast(file: string): Promise<LastSent | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as LastSent
  } catch {
    return null
  }
}

export async function runHook(opts: { arg: string; stdin: string; env: NodeJS.ProcessEnv; now?: number }): Promise<WireEvent | null> {
  const input = pickInput(opts.stdin)
  const type = eventTypeFor(opts.arg, input)
  if (!type) return null
  const home = burrowHome(opts.env)
  const cfg = await readConfig(home)
  if (!cfg) return null

  const now = opts.now ?? Date.now()
  const session = sessionHash(cfg.salt, input.session_id ?? '')
  const dir = join(home, 'sessions')
  const file = join(dir, `${session}.json`)
  if (!shouldSend(type, await readLast(file), now)) return null
  if (type === 'session_end') {
    await rm(file, { force: true })
  } else {
    await mkdir(dir, { recursive: true })
    await writeFile(file, JSON.stringify({ type, at: now } satisfies LastSent))
  }

  const event: WireEvent = { v: 1, type, at: now, session }
  try {
    await fetch(`${cfg.apiUrl}/v1/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    // Offline or API down: the pet misses one beat. Never bother the agent.
  }
  return event
}
