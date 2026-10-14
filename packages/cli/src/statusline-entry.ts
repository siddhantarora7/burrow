import { spawn, spawnSync } from 'node:child_process'
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { burrowHome, readConfig } from './config'
import { sessionHash } from './hook'
import { statusLines, type ClaudeStatus, type GardenSnap } from './statusline'

// Claude Code runs this for every status-line update. It must be quick, never wait on the network and never fail.
const home = burrowHome()
const cacheFile = join(home, 'garden.json')
const MIN = 60_000

function readStdin(timeoutMs: number): Promise<string> {
  if (process.stdin.isTTY) return Promise.resolve('')
  return new Promise((resolve) => {
    let data = ''
    const timer = setTimeout(() => resolve(data), timeoutMs)
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => (clearTimeout(timer), resolve(data)))
    process.stdin.on('error', () => resolve(data))
  })
}

/** Background mode: fetch the garden once and write the cache. Runs detached, so nobody waits for it. */
async function refresh(): Promise<void> {
  const cfg = await readConfig(home)
  if (!cfg?.burrows[0]) return
  const res = await fetch(`${cfg.apiUrl}/v1/burrows/${cfg.burrows[0]}/snapshot`, { signal: AbortSignal.timeout(3000) })
  if (!res.ok) return
  const s = (await res.json()) as { members: GardenSnap['members']; serverNow: number }
  const snap: GardenSnap = { members: s.members, serverNow: s.serverNow, fetchedAt: Date.now() }
  const tmp = `${cacheFile}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(snap))
  await rename(tmp, cacheFile)
}

/** Has this machine's agent done anything in the last 10 minutes? The hook touches a file per session. */
async function activeHere(now: number): Promise<boolean> {
  const dir = join(home, 'sessions')
  const names = await readdir(dir).catch(() => [] as string[])
  for (const n of names) if (n.endsWith('.json') && !n.endsWith('.usage.json') && now - (await stat(join(dir, n))).mtimeMs < 10 * MIN) return true
  return false
}

async function main(): Promise<void> {
  if (process.argv[2] === '--refresh') return refresh()
  const raw = await readStdin(1000)
  const cfg = await readConfig(home)
  if (!cfg) return
  let claude: ClaudeStatus = {}
  try {
    const j = JSON.parse(raw) as unknown
    if (j && typeof j === 'object') claude = j as ClaudeStatus
  } catch {
    // no input: still show the pet
  }
  const now = Date.now()

  // Claude Code's own cost estimate, kept for the hook to send as an increase on the next stop
  const cost = claude.cost?.total_cost_usd
  if (cfg.usage && typeof claude.session_id === 'string' && typeof cost === 'number' && Number.isFinite(cost)) {
    await mkdir(join(home, 'sessions'), { recursive: true })
    await writeFile(join(home, 'sessions', `${sessionHash(cfg.salt, claude.session_id)}.cost`), String(cost))
  }

  let snap: GardenSnap | null = null
  try {
    snap = JSON.parse(await readFile(cacheFile, 'utf8')) as GardenSnap
  } catch {
    snap = null
  }
  // once a minute while you work, every 5 minutes otherwise: a garden of friends costs few requests
  const age = snap ? now - snap.fetchedAt : Infinity
  if (age > MIN && (age > 5 * MIN || (await activeHere(now)))) {
    spawn(process.execPath, [process.argv[1]!, '--refresh'], { detached: true, stdio: 'ignore' }).unref()
  }

  if (cfg.statusThen) {
    const r = spawnSync('sh', ['-c', cfg.statusThen], { input: raw, timeout: 1500, encoding: 'utf8' })
    const theirs = (r.stdout ?? '').replace(/\n+$/, '')
    if (theirs) console.log(theirs)
  }
  const me = { petId: cfg.petId, name: cfg.pet.name, species: cfg.pet.species }
  for (const line of statusLines({ claude, me, snap, now, color: !process.env.NO_COLOR })) console.log(line)
}

main()
  .catch(() => {})
  .finally(() => process.exit(0))
