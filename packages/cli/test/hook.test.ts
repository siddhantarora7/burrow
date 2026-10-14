import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeConfig } from '../src/config'
import { eventTypeFor, pickInput, runHook, sessionHash, shouldSend, HEARTBEAT_MIN_MS } from '../src/hook'

const SALT = 'f'.repeat(32)
const fullClaudeInput = JSON.stringify({
  session_id: '6c7f2a10-0000-4000-8000-123456789abc',
  transcript_path: '/Users/me/.claude/projects/secret-repo/t.jsonl',
  cwd: '/Users/me/code/secret-repo',
  prompt: 'refactor the payments module',
  tool_input: { command: 'cat .env' },
  notification_type: 'permission_prompt',
  hook_event_name: 'Notification',
})

async function setup(apiUrl = 'http://api.test', usage = false) {
  const home = await mkdtemp(join(tmpdir(), 'burrow-hook-'))
  await writeConfig(home, {
    apiUrl, webUrl: 'http://web.test', petId: 'abcdefghjk', token: 'abcdefghjk.abcdefghjkmnpqrstvwxyz012',
    salt: SALT, burrows: [], pet: { name: 'kiwi', species: 'mochi', color: 'sakura' }, ...(usage ? { usage: true } : {}),
  })
  return { BURROW_HOME: home }
}

afterEach(() => vi.unstubAllGlobals())

describe('pickInput', () => {
  it('keeps only session_id, notification_type and transcript_path (read locally, never sent)', () => {
    expect(pickInput(fullClaudeInput)).toEqual({
      session_id: '6c7f2a10-0000-4000-8000-123456789abc',
      notification_type: 'permission_prompt',
      transcript_path: '/Users/me/.claude/projects/secret-repo/t.jsonl',
    })
  })
  it.each(['', 'not json', '[1,2]', 'null', '{"session_id": 7}'])('survives %j', (raw) => {
    expect(pickInput(raw)).toEqual({})
  })
})

describe('eventTypeFor', () => {
  it('maps notify by notification_type and ignores the rest', () => {
    expect(eventTypeFor('notify', { notification_type: 'permission_prompt' })).toBe('needs_input')
    expect(eventTypeFor('notify', { notification_type: 'agent_needs_input' })).toBe('needs_input')
    expect(eventTypeFor('notify', { notification_type: 'elicitation_dialog' })).toBe('needs_input')
    expect(eventTypeFor('notify', { notification_type: 'idle_prompt' })).toBeNull()
    expect(eventTypeFor('notify', {})).toBeNull()
  })
  it('passes through the other args and rejects unknown ones', () => {
    for (const a of ['session_start', 'prompt', 'heartbeat', 'stop', 'error', 'session_end']) {
      expect(eventTypeFor(a, {})).toBe(a)
    }
    expect(eventTypeFor('tool_use', {})).toBeNull()
  })
})

describe('sessionHash', () => {
  it('is 12 hex chars, salted, and stable', () => {
    const h = sessionHash(SALT, 'abc')
    expect(h).toMatch(/^[0-9a-f]{12}$/)
    expect(sessionHash(SALT, 'abc')).toBe(h)
    expect(sessionHash('0'.repeat(32), 'abc')).not.toBe(h)
  })
})

describe('shouldSend', () => {
  const now = 1_791_000_000_000
  it('always sends non-heartbeats', () => {
    expect(shouldSend('stop', { type: 'stop', at: now }, now)).toBe(true)
  })
  it('throttles only consecutive heartbeats', () => {
    expect(shouldSend('heartbeat', null, now)).toBe(true)
    expect(shouldSend('heartbeat', { type: 'needs_input', at: now - 1000 }, now)).toBe(true)
    expect(shouldSend('heartbeat', { type: 'heartbeat', at: now - 1000 }, now)).toBe(false)
    expect(shouldSend('heartbeat', { type: 'heartbeat', at: now - HEARTBEAT_MIN_MS }, now)).toBe(true)
  })
})

describe('runHook', () => {
  it('sends exactly the four fields, never the Claude input', async () => {
    const env = await setup()
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const sent = await runHook({ arg: 'notify', stdin: fullClaudeInput, env, now: 1_791_000_000_000 })
    expect(sent).toEqual({
      v: 1, type: 'needs_input', at: 1_791_000_000_000,
      session: sessionHash(SALT, '6c7f2a10-0000-4000-8000-123456789abc'),
    })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://api.test/v1/events')
    expect(JSON.parse(init.body as string)).toEqual(sent)
    expect(init.body as string).not.toMatch(/secret-repo|payments|\.env|6c7f2a10/)
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer abcdefghjk.abcdefghjkmnpqrstvwxyz012')
  })
  it('sends with a stable session even when stdin is empty', async () => {
    const env = await setup()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    const a = await runHook({ arg: 'stop', stdin: '', env })
    const b = await runHook({ arg: 'stop', stdin: 'garbage', env })
    expect(a?.session).toBe(sessionHash(SALT, ''))
    expect(b?.session).toBe(a?.session)
  })
  it('does nothing without a config (not initialized)', async () => {
    const home = await mkdtemp(join(tmpdir(), 'burrow-empty-'))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await runHook({ arg: 'stop', stdin: '', env: { BURROW_HOME: home } })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('throttles heartbeats per session on disk', async () => {
    const env = await setup()
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const stdin = JSON.stringify({ session_id: 's1' })
    await runHook({ arg: 'heartbeat', stdin, env, now: 1000 })
    await runHook({ arg: 'heartbeat', stdin, env, now: 2000 })
    await runHook({ arg: 'heartbeat', stdin, env, now: 1000 + HEARTBEAT_MIN_MS })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('forgets the session file on session_end', async () => {
    const env = await setup()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    const stdin = JSON.stringify({ session_id: 's2' })
    await runHook({ arg: 'prompt', stdin, env })
    await runHook({ arg: 'session_end', stdin, env })
    expect(await readdir(join(env.BURROW_HOME, 'sessions'))).toEqual([])
  })
  it('gives up within ~3 s when the API hangs, without throwing', async () => {
    // A TCP server that accepts and never answers.
    const server = createServer(() => {}).listen(0)
    await new Promise((r) => server.once('listening', r))
    const port = (server.address() as { port: number }).port
    const env = await setup(`http://127.0.0.1:${port}`)
    const started = Date.now()
    await expect(runHook({ arg: 'stop', stdin: '', env })).resolves.not.toBeNull()
    expect(Date.now() - started).toBeLessThan(4000)
    server.close()
  }, 8000)
})

describe('runHook: usage sharing', () => {
  const stopWith = async (path: string) => JSON.stringify({ session_id: 's1', transcript_path: path })
  async function transcriptFile() {
    const dir = await mkdtemp(join(tmpdir(), 'burrow-t-'))
    const path = join(dir, 't.jsonl')
    await writeFile(path, JSON.stringify({ message: { id: 'm1', usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 9 } } }) + '\n')
    return path
  }
  const bodies = (m: ReturnType<typeof vi.fn>) => m.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string))
  it('adds usage to a stop when sharing is on', async () => {
    const env = await setup('http://api.test', true)
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await runHook({ arg: 'stop', stdin: await stopWith(await transcriptFile()), env })
    expect(bodies(fetchMock)[0].usage).toEqual({ tokens: 10 })
  })
  it('never adds usage when sharing is off', async () => {
    const env = await setup()
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await runHook({ arg: 'stop', stdin: await stopWith(await transcriptFile()), env })
    expect(Object.keys(bodies(fetchMock)[0]).sort()).toEqual(['at', 'session', 'type', 'v'])
  })
  it('resends once without usage when an older server refuses it', async () => {
    const env = await setup('http://api.test', true)
    const fetchMock = vi.fn(async () => new Response(null, { status: fetchMock.mock.calls.length === 1 ? 400 : 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await runHook({ arg: 'stop', stdin: await stopWith(await transcriptFile()), env })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(bodies(fetchMock)[1].usage).toBeUndefined()
  })
})
