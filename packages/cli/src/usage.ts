import { mkdir, open, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { WireUsage } from '@burrow/core'

/** How far into a session's transcript we have read, and how much of its cost was already sent. Local only. */
export interface UsageState {
  offset: number
  lastId?: string
  costSent?: number
}

const BIG = 20_000_000
const FIELDS = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens'] as const

/**
 * Sums the tokens Claude Code recorded since `st.offset`. One message spans several lines with the same id,
 * so each id counts once. A partial last line is left for next time. Only the sum leaves this function.
 */
export async function readTokens(path: string, st: UsageState | null): Promise<{ tokens: number; st: UsageState }> {
  let fh
  try {
    fh = await open(path, 'r')
  } catch {
    return { tokens: 0, st: st ?? { offset: 0 } }
  }
  try {
    const { size } = await fh.stat()
    // turning sharing on halfway through a long session counts from now, so the hook stays quick
    const start = Math.min(st?.offset ?? (size > BIG ? size : 0), size)
    const buf = Buffer.alloc(size - start)
    await fh.read(buf, 0, buf.length, start)
    const end = buf.lastIndexOf(10) + 1
    const seen = new Set<string>()
    let tokens = 0
    let lastId = st?.lastId
    for (const raw of buf.subarray(0, end).toString('utf8').split('\n')) {
      if (!raw) continue
      let m: { id?: unknown; usage?: Record<string, unknown> } | undefined
      try {
        m = (JSON.parse(raw) as { message?: typeof m }).message
      } catch {
        continue
      }
      if (typeof m?.id !== 'string' || !m.usage || m.id === st?.lastId || seen.has(m.id)) continue
      seen.add(m.id)
      lastId = m.id
      for (const f of FIELDS) if (typeof m.usage[f] === 'number') tokens += m.usage[f] as number
    }
    return { tokens, st: { ...st, offset: start + end, ...(lastId ? { lastId } : {}) } }
  } finally {
    await fh.close()
  }
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return null
  }
}

/** The tokens and cost added since this session's last event, or undefined when nothing changed. */
export async function usageFor(home: string, session: string, transcript: string | undefined): Promise<WireUsage | undefined> {
  const dir = join(home, 'sessions')
  const file = join(dir, `${session}.usage.json`)
  const prev = await readJson<UsageState>(file)
  const read = transcript ? await readTokens(transcript, prev) : { tokens: 0, st: prev ?? { offset: 0 } }
  // the burrow status line writes Claude Code's own cost estimate for the session here
  const cost = Number(await readFile(join(dir, `${session}.cost`), 'utf8').catch(() => ''))
  const st: UsageState = { ...read.st }
  const out: WireUsage = {}
  if (read.tokens > 0) out.tokens = Math.min(read.tokens, 50_000_000)
  if (Number.isFinite(cost) && cost > 0) {
    const delta = Math.round((cost - (prev?.costSent ?? 0)) * 1e6) / 1e6
    if (delta > 0) out.cost = Math.min(delta, 500)
    st.costSent = Math.max(cost, prev?.costSent ?? 0)
  }
  await mkdir(dir, { recursive: true })
  await writeFile(file, JSON.stringify(st))
  return Object.keys(out).length ? out : undefined
}
