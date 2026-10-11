// End-to-end: hatch two friends with the real CLI, fire real hook invocations, sign a browser in,
// poke a waiting pet, and watch the burrow websocket.
// Needs: npm run build:cli, and `npm run dev:server` running.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const API = process.env.BURROW_API_URL ?? 'http://127.0.0.1:8787'
const home = mkdtempSync(join(tmpdir(), 'burrow-smoke-'))
const friendHome = mkdtempSync(join(tmpdir(), 'burrow-smoke-friend-'))
const envFor = (h) => ({ ...process.env, NO_COLOR: '1', BURROW_HOME: h, CLAUDE_SETTINGS: join(h, 'claude-settings.json'), BURROW_API_URL: API })
const env = envFor(home)
const run = (args, input, e = env) => execFileSync('node', args, { env: e, input, encoding: 'utf8' })
const fail = (why) => { throw new Error(why) }
const post = async (path, body) => { const r = await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return [r.status, await r.json().catch(() => null)] }

run(['packages/cli/dist/cli.mjs', 'init', '--name', 'smoke', '--species', 'onigiri'])
const cfg = JSON.parse(readFileSync(join(home, 'config.json'), 'utf8'))

// a friend moves in with the plain link, then signs a browser in with a one-time claim
run(['packages/cli/dist/cli.mjs', 'init', `http://localhost:3000/b/${cfg.burrows[0]}`, '--name', 'pal', '--species', 'tofu', '--color', 'sora'], '', envFor(friendHome))
const friend = JSON.parse(readFileSync(join(friendHome, 'config.json'), 'utf8'))
if (friend.burrows[0] !== cfg.burrows[0]) fail('the friend should live in the same burrow')
const claim = /#claim=([a-z0-9.]+)/.exec(run(['packages/cli/dist/cli.mjs', 'open'], '', envFor(friendHome)))?.[1] ?? fail('open printed no claim link')
const [ok, web] = await post('/v1/claim', { claim })
if (ok !== 200 || web.petId !== friend.petId) fail(`claim should redeem once (got ${ok})`)
if ((await post('/v1/claim', { claim }))[0] !== 401) fail('a claim must not redeem twice')
const settings = JSON.parse(readFileSync(env.CLAUDE_SETTINGS, 'utf8'))
if (Object.keys(settings.hooks).length !== 8) throw new Error('expected 8 hook events in settings')

const ws = new WebSocket(`${API.replace(/^http/, 'ws')}/v1/burrows/${cfg.burrows[0]}/ws`)
const got = []
ws.onmessage = (e) => got.push(JSON.parse(e.data))
await new Promise((r) => (ws.onopen = r))
ws.send(JSON.stringify({ t: 'hello', token: web.token }))

const claudeInput = JSON.stringify({ session_id: 'smoke-session', cwd: '/very/secret', prompt: 'do not leak me' })
const hook = join(home, 'burrow-hook.mjs')
run([hook, 'prompt'], claudeInput)
run([hook, 'notify'], JSON.stringify({ session_id: 'smoke-session', notification_type: 'permission_prompt' }))
await new Promise((r) => setTimeout(r, 300))
ws.send(JSON.stringify({ t: 'poke', to: cfg.petId })) // the friend pokes the waiting pet
ws.send(JSON.stringify({ t: 'poke', to: cfg.petId })) // again within a minute: dropped
await new Promise((r) => setTimeout(r, 300))
run([hook, 'stop'], claudeInput)
await new Promise((r) => setTimeout(r, 1000))
ws.close()

const types = got.filter((m) => m.t === 'event').map((m) => m.ev.type)
const raw = JSON.stringify(got)
if (got[0]?.t !== 'snapshot') throw new Error('first message must be a snapshot')
if (got[0].members.length !== 2) fail(`expected two members, got ${got[0].members.length}`)
if (!got.some((m) => m.t === 'welcome' && m.me === friend.petId)) fail('hello with a web token should be welcomed')
const pokes = got.filter((m) => m.t === 'poke')
if (pokes.length !== 1 || pokes[0].from !== friend.petId || pokes[0].to !== cfg.petId) fail(`expected exactly one poke, got ${JSON.stringify(pokes)}`)
if (!(got.filter((m) => m.t === 'event').at(-1)?.today?.waitedMs > 0)) fail('waited-on-you time should grow once the wait closes')
if (types.join() !== 'prompt,needs_input,stop') throw new Error(`unexpected events: ${types.join()}`)
if (/secret|leak|smoke-session/.test(raw)) throw new Error('private data reached the burrow')
run(['packages/cli/dist/cli.mjs', 'uninstall'])
run(['packages/cli/dist/cli.mjs', 'uninstall'], '', envFor(friendHome))
console.log(`smoke ok: two friends, claim once, hello, one poke, waited-today; ${types.join(' -> ')}; no private data on the wire`)
