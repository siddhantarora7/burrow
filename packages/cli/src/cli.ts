import { randomBytes } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join as joinPath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { cleanName, isSpecies, parseBurrowLink, SPECIES, type Member, type PetColor, type Species } from '@burrow/core'
import { burrowHome, claudeSettingsPath, HOOK_FILE, readConfig, STATUS_FILE, writeConfig, type BurrowConfig } from './config'
import { claimUrl, colorMenu, pickColor } from './helpers'
import { checkSettings, installHooks, installStatusLine, uninstallStatusLine } from './install'
import { removeHooks, SettingsError, updateSettingsFile } from './settings'
import { statsTable } from './table'
import { bold, dim, FACE, green, hookTable, privacyBlock } from './ui'

const here = dirname(fileURLToPath(import.meta.url))
// baked in by build.mjs: production for the published package, the dev servers otherwise
declare const __BURROW_API__: string
declare const __BURROW_WEB__: string
const DEFAULT_API = __BURROW_API__
const DEFAULT_WEB = __BURROW_WEB__

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: 'string' },
    species: { type: 'string' },
    color: { type: 'string' },
    api: { type: 'string' },
    web: { type: 'string' },
    week: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
})

const USAGE = `
  ${bold('burrow-pets')}  a tiny pet that reacts live to claude code

  npx burrow-pets init [link]               hatch a pet and install the hooks (with a friend's link: move in with them)
  npx burrow-pets join <link>               also live in a friend's burrow
  npx burrow-pets open [link]               a sign-in link for this browser (alerts and pokes)
  npx burrow-pets status                    your pet, your burrows, hook status
  npx burrow-pets rename <name>             give your pet a new name, in every garden
  npx burrow-pets stats [--week] [link]     your garden's day (or week) as a table
  npx burrow-pets privacy                   exactly what gets sent
  npx burrow-pets usage on|off              share token and cost totals with your garden (off by default)
  npx burrow-pets statusline on|off         your pet and friends in claude code's status line
  npx burrow-pets uninstall                 remove the hooks and your local pet data
`

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

async function api<T>(apiUrl: string, path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  const out = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (res.status === 404) throw new Error("that burrow doesn't exist. check the link")
  if (res.status === 409) throw new Error('that burrow is full (24 pets)')
  if (!res.ok) throw new Error(out.error ?? `request failed (${res.status})`)
  return out
}

/** The burrow in positionals[1], if one was given; throws on a link that isn't one. */
function linkArg(): string | null {
  const raw = positionals[1]
  if (!raw) return null
  const id = parseBurrowLink(raw)
  if (!id) throw new Error(`that doesn't look like a burrow link: ${raw}`)
  return id
}

function signInLine(webUrl: string, burrowId: string, claim: string): string {
  return `  open it here  ${bold(claimUrl(webUrl, burrowId, claim))}
  ${dim('this link signs this browser in once (alerts and pokes) and expires in 10 minutes.')}
  ${dim('send friends the plain link:')} ${webUrl}/b/${burrowId}`
}

async function joinBurrow(cfg: BurrowConfig, burrowId: string): Promise<void> {
  const r = await api<{ burrowId: string; name: string }>(cfg.apiUrl, `/v1/burrows/${burrowId}/join`, {}, cfg.token)
  if (!cfg.burrows.includes(r.burrowId)) cfg.burrows.push(r.burrowId)
  await writeConfig(burrowHome(), cfg)
  const { claim } = await api<{ claim: string }>(cfg.apiUrl, '/v1/claims', {}, cfg.token)
  console.log(`\n  ${FACE[cfg.pet.species]}  ${cfg.pet.name} moved into ${bold(r.name)}\n\n${signInLine(cfg.webUrl, r.burrowId, claim)}\n`)
}

async function init(): Promise<void> {
  const invite = linkArg()
  const home = burrowHome()
  const settingsPath = claudeSettingsPath()
  const hookSource = joinPath(here, HOOK_FILE)
  // Fail on unusable settings before hatching anything, so a retry never orphans a pet.
  await checkSettings(settingsPath)
  const existing = await readConfig(home)
  if (existing) {
    // Re-running init repairs the hooks (e.g. after fixing settings.json) without hatching again.
    const added = await installHooks({ home, settingsPath, hookSource })
    const note = added.length ? `reinstalled ${added.length} hooks.` : 'hooks are already installed.'
    console.log(`\n  ${FACE[existing.pet.species]}  ${existing.pet.name} already lives here. ${note}`)
    if (invite) await joinBurrow(existing, invite)
    else console.log()
    return
  }
  const interactive = process.stdin.isTTY
  let name = cleanName(values.name)
  while (!name) {
    if (!interactive) throw new Error('pass --name (1-16 letters, digits, spaces, - or _)')
    name = cleanName(await ask(`  name your pet: `))
    if (!name) console.log(dim('  1-16 letters, digits, spaces, - or _'))
  }
  let species: Species | null = isSpecies(values.species) ? values.species : null
  while (!species) {
    if (!interactive) throw new Error(`pass --species (${SPECIES.join(', ')})`)
    const pick = await ask(`  species: ${SPECIES.map((s, i) => `${i + 1} ${s} ${FACE[s]}`).join('   ')}  > `)
    species = SPECIES[Number(pick) - 1] ?? (isSpecies(pick) ? pick : null)
  }
  let color: PetColor | null = values.color === undefined ? null : pickColor(values.color, species)
  if (values.color !== undefined && !color) throw new Error(`unknown color: ${values.color}`)
  while (!color) {
    color = interactive ? pickColor(await ask(`  colour: ${colorMenu(species)}  > `), species) : pickColor('', species)
  }

  const usage = !!interactive && /^y/i.test(await ask(`  share token and cost totals with your garden? ${dim('(y/N)')}  > `))
  const wantStatus = !!interactive && !/^n/i.test(await ask(`  show your pet in claude code's status line? ${dim('(Y/n)')}  > `))

  const apiUrl = (values.api ?? process.env.BURROW_API_URL ?? DEFAULT_API).replace(/\/$/, '')
  const webUrl = (values.web ?? process.env.BURROW_WEB_URL ?? DEFAULT_WEB).replace(/\/$/, '')
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const body = await api<{ petId: string; token: string; burrowId: string; claim: string }>(apiUrl, '/v1/pets', { name, species, color, tz, ...(invite ? { burrowId: invite } : {}) })

  const cfg: BurrowConfig = {
    apiUrl, webUrl, petId: body.petId, token: body.token, salt: randomBytes(16).toString('hex'),
    burrows: [body.burrowId], pet: { name, species, color }, ...(usage ? { usage: true } : {}),
  }
  await writeConfig(home, cfg)
  const added = await installHooks({ home, settingsPath, hookSource })
  if (wantStatus) {
    const then = await installStatusLine({ home, settingsPath, source: joinPath(here, STATUS_FILE) })
    if (then) await writeConfig(home, { ...cfg, statusThen: then })
  }

  console.log(`
  ${FACE[species]}  ${green('hatched')} ${bold(name)} the ${species}

  installed ${added.length} claude code hooks in ${dim(settingsPath)}
${privacyBlock(usage)}

  ${invite ? 'you moved into a friend\'s burrow.' : 'your burrow is ready. send the plain link to friends; keep it open on a second screen.'}

${signInLine(webUrl, body.burrowId, body.claim)}
`)
}

async function join(): Promise<void> {
  const cfg = await readConfig(burrowHome())
  if (!cfg) throw new Error(`no pet yet. run npx burrow-pets init ${positionals[1] ?? '<link>'}`)
  const id = linkArg()
  if (!id) throw new Error('pass the burrow link: npx burrow-pets join <link>')
  await joinBurrow(cfg, id)
}

async function open(): Promise<void> {
  const cfg = await readConfig(burrowHome())
  if (!cfg) throw new Error('no pet yet. run npx burrow-pets init')
  const id = linkArg() ?? cfg.burrows[0]!
  const { claim } = await api<{ claim: string }>(cfg.apiUrl, '/v1/claims', {}, cfg.token)
  console.log(`\n${signInLine(cfg.webUrl, id, claim)}\n`)
}

async function status(): Promise<void> {
  const cfg = await readConfig(burrowHome())
  if (!cfg) {
    console.log(`\n  no pet yet. run ${bold('npx burrow-pets init')}\n`)
    return
  }
  console.log(`
  ${FACE[cfg.pet.species]}  ${bold(cfg.pet.name)} the ${cfg.pet.species}
  burrow   ${cfg.burrows.map((b) => `${cfg.webUrl}/b/${b}`).join('\n           ')}
  api      ${dim(cfg.apiUrl)}
`)
}

async function privacy(): Promise<void> {
  const cfg = await readConfig(burrowHome())
  console.log(`\n${privacyBlock(!!cfg?.usage)}\n\n  hooks:\n${hookTable()}\n`)
}

/** `rename <name>`: the same pet and gardens, a new name everywhere. */
async function rename(): Promise<void> {
  const home = burrowHome()
  const cfg = await readConfig(home)
  if (!cfg) throw new Error('no pet yet. run npx burrow-pets init')
  const name = cleanName(positionals.slice(1).join(' '))
  if (!name) throw new Error('pass a name: npx burrow-pets rename <name> (1-16 letters, digits, spaces, - or _)')
  const r = await api<{ name: string }>(cfg.apiUrl, '/v1/pets/rename', { name }, cfg.token)
  await writeConfig(home, { ...cfg, pet: { ...cfg.pet, name: r.name } })
  console.log(`\n  ${FACE[cfg.pet.species]}  ${cfg.pet.name} is now ${bold(r.name)}, in every garden it lives in.\n`)
}

/** `stats [--week] [link]`: the garden's numbers, from the same snapshot the page gets. */
async function stats(): Promise<void> {
  const cfg = await readConfig(burrowHome())
  if (!cfg) throw new Error('no pet yet. run npx burrow-pets init')
  const id = linkArg() ?? cfg.burrows[0]!
  const res = await fetch(`${cfg.apiUrl}/v1/burrows/${id}/snapshot`, { signal: AbortSignal.timeout(10_000) })
  if (res.status === 404) throw new Error("that burrow doesn't exist. check the link")
  if (!res.ok) throw new Error(`request failed (${res.status})`)
  const snap = (await res.json()) as { burrow: { name: string }; members: Member[]; serverNow: number }
  console.log(statsTable({
    burrowName: snap.burrow.name, members: snap.members, me: cfg.petId, week: !!values.week,
    webUrl: cfg.webUrl, burrowId: id, color: !!process.stdout.isTTY && !process.env.NO_COLOR, now: snap.serverNow, todayKey: new Date().toLocaleDateString('en-CA'),
  }))
}

/** `statusline on|off`: burrow's line in Claude Code, under any status line you already had. */
async function statusline(): Promise<void> {
  const home = burrowHome()
  const cfg = await readConfig(home)
  if (!cfg) throw new Error('no pet yet. run npx burrow-pets init')
  const settingsPath = claudeSettingsPath()
  if (positionals[1] === 'off') {
    await uninstallStatusLine({ home, settingsPath, then: cfg.statusThen })
    const { statusThen: _gone, ...rest } = cfg
    await writeConfig(home, rest)
    console.log(`\n  removed burrow's status line${cfg.statusThen ? ' and put yours back' : ''}.\n`)
    return
  }
  if (positionals[1] !== 'on') {
    console.log(`\n  ${dim('npx burrow-pets statusline on|off')}\n`)
    return
  }
  const then = await installStatusLine({ home, settingsPath, source: joinPath(here, STATUS_FILE) })
  if (then) await writeConfig(home, { ...cfg, statusThen: then })
  console.log(`\n  ${FACE[cfg.pet.species]}  ${cfg.pet.name} is in your status line${then ? ', under the one you had' : ''}. it shows up on claude code's next update.\n`)
}

/** `usage on|off`: whether stops carry token and cost increases. */
async function usage(): Promise<void> {
  const home = burrowHome()
  const cfg = await readConfig(home)
  if (!cfg) throw new Error('no pet yet. run npx burrow-pets init')
  const want = positionals[1]
  if (want !== 'on' && want !== 'off') {
    console.log(`\n  usage sharing is ${bold(cfg.usage ? 'on' : 'off')}. ${dim('npx burrow-pets usage on|off')}\n`)
    return
  }
  await writeConfig(home, { ...cfg, usage: want === 'on' })
  // older installs copied a hook script without the transcript reader
  await installHooks({ home, settingsPath: claudeSettingsPath(), hookSource: joinPath(here, HOOK_FILE) })
  console.log(`\n${privacyBlock(want === 'on')}\n${want === 'on' ? `\n  ${dim('cost needs the burrow status line: npx burrow-pets statusline on')}\n` : ''}`)
}

async function uninstall(): Promise<void> {
  const home = burrowHome()
  const cfg = await readConfig(home)
  await uninstallStatusLine({ home, settingsPath: claudeSettingsPath(), then: cfg?.statusThen })
  let removed = 0
  await updateSettingsFile(claudeSettingsPath(), joinPath(home, 'backups'), (s) => {
    const r = removeHooks(s)
    removed = r.removed
    return r.settings
  })
  await rm(home, { recursive: true, force: true })
  console.log(`\n  removed ${removed} hooks and ${dim(home)}. bye for now.\n`)
}

const commands: Record<string, () => Promise<void>> = { init, join, open, status, rename, stats, privacy, usage, statusline, uninstall }
const cmd = positionals[0]
if (values.help || !cmd || !commands[cmd]) {
  console.log(USAGE)
} else {
  await mkdir(burrowHome(), { recursive: true, mode: 0o700 }).catch(() => {})
  try {
    await commands[cmd]()
  } catch (e) {
    console.error(`\n  ${e instanceof SettingsError ? e.message : `burrow: ${(e as Error).message}`}\n`)
    process.exitCode = 1
  }
}
