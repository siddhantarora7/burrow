// End-to-end: hatch with the real CLI, fire real hook invocations, watch the burrow websocket.
// Needs: npm run build:cli, and `npm run dev:server` running.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const API = process.env.BURROW_API_URL ?? 'http://127.0.0.1:8787'
const home = mkdtempSync(join(tmpdir(), 'burrow-smoke-'))
const env = { ...process.env, BURROW_HOME: home, CLAUDE_SETTINGS: join(home, 'claude-settings.json'), BURROW_API_URL: API }
const run = (args, input) => execFileSync('node', args, { env, input, encoding: 'utf8' })

run(['packages/cli/dist/cli.mjs', 'init', '--name', 'smoke', '--species', 'onigiri'])
const cfg = JSON.parse(readFileSync(join(home, 'config.json'), 'utf8'))
const settings = JSON.parse(readFileSync(env.CLAUDE_SETTINGS, 'utf8'))
if (Object.keys(settings.hooks).length !== 7) throw new Error('expected 7 hook events in settings')

const ws = new WebSocket(`${API.replace(/^http/, 'ws')}/v1/burrows/${cfg.burrows[0]}/ws`)
const got = []
ws.onmessage = (e) => got.push(JSON.parse(e.data))
await new Promise((r) => (ws.onopen = r))

const claudeInput = JSON.stringify({ session_id: 'smoke-session', cwd: '/very/secret', prompt: 'do not leak me' })
const hook = join(home, 'burrow-hook.mjs')
run([hook, 'prompt'], claudeInput)
run([hook, 'notify'], JSON.stringify({ session_id: 'smoke-session', notification_type: 'permission_prompt' }))
run([hook, 'stop'], claudeInput)
await new Promise((r) => setTimeout(r, 1000))
ws.close()

const types = got.filter((m) => m.t === 'event').map((m) => m.ev.type)
const raw = JSON.stringify(got)
if (got[0]?.t !== 'snapshot') throw new Error('first message must be a snapshot')
if (types.join() !== 'prompt,needs_input,stop') throw new Error(`unexpected events: ${types.join()}`)
if (/secret|leak|smoke-session/.test(raw)) throw new Error('private data reached the burrow')
run(['packages/cli/dist/cli.mjs', 'uninstall'])
console.log(`smoke ok: snapshot + ${types.join(' -> ')}; no private data on the wire`)
