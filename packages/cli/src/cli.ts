import { randomBytes } from 'node:crypto'
import { copyFile, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { cleanName, DEFAULT_COLOR, isSpecies, SPECIES, type Species } from '@burrow/core'
import { burrowHome, claudeSettingsPath, HOOK_FILE, readConfig, writeConfig, type BurrowConfig } from './config'
import { addHooks, removeHooks, SettingsError, updateSettingsFile } from './settings'
import { bold, dim, FACE, green, hookTable, privacyBlock } from './ui'

const here = dirname(fileURLToPath(import.meta.url))
const DEFAULT_API = 'http://127.0.0.1:8787'
const DEFAULT_WEB = 'http://localhost:3000'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: 'string' },
    species: { type: 'string' },
    api: { type: 'string' },
    web: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
})

const USAGE = `
  ${bold('burrow-pets')}  a tiny pet that reacts live to claude code

  npx burrow-pets init        hatch a pet and install the hooks
  npx burrow-pets status      your pet, your burrow, hook status
  npx burrow-pets privacy     exactly what gets sent
  npx burrow-pets uninstall   remove the hooks and your local pet data
`

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

async function init(): Promise<void> {
  const home = burrowHome()
  const existing = await readConfig(home)
  if (existing) {
    console.log(`\n  ${FACE[existing.pet.species]}  ${existing.pet.name} already lives here. run ${bold('npx burrow-pets status')}.\n`)
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

  const apiUrl = (values.api ?? process.env.BURROW_API_URL ?? DEFAULT_API).replace(/\/$/, '')
  const webUrl = (values.web ?? process.env.BURROW_WEB_URL ?? DEFAULT_WEB).replace(/\/$/, '')
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const res = await fetch(`${apiUrl}/v1/pets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, species, tz }),
    signal: AbortSignal.timeout(10_000),
  })
  const body = (await res.json()) as { petId?: string; token?: string; burrowId?: string; error?: string }
  if (!res.ok || !body.petId || !body.token || !body.burrowId) throw new Error(body.error ?? `hatching failed (${res.status})`)

  const cfg: BurrowConfig = {
    apiUrl, webUrl, petId: body.petId, token: body.token, salt: randomBytes(16).toString('hex'),
    burrows: [body.burrowId], pet: { name, species, color: DEFAULT_COLOR[species] },
  }
  await writeConfig(home, cfg)
  const script = join(home, HOOK_FILE)
  await copyFile(join(here, HOOK_FILE), script)
  const settingsPath = claudeSettingsPath()
  let added: string[] = []
  await updateSettingsFile(settingsPath, join(home, 'backups'), (s) => {
    const r = addHooks(s, script)
    added = r.added
    return r.settings
  })

  console.log(`
  ${FACE[species]}  ${green('hatched')} ${bold(name)} the ${species}

  installed ${added.length} claude code hooks in ${dim(settingsPath)}
${privacyBlock()}

  your burrow   ${bold(`${webUrl}/b/${body.burrowId}`)}
  ${dim('send it to friends. keep it open on a second screen.')}
`)
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
  console.log(`\n${privacyBlock()}\n\n  hooks:\n${hookTable()}\n`)
}

async function uninstall(): Promise<void> {
  const home = burrowHome()
  let removed = 0
  await updateSettingsFile(claudeSettingsPath(), join(home, 'backups'), (s) => {
    const r = removeHooks(s)
    removed = r.removed
    return r.settings
  })
  await rm(home, { recursive: true, force: true })
  console.log(`\n  removed ${removed} hooks and ${dim(home)}. bye for now.\n`)
}

const commands: Record<string, () => Promise<void>> = { init, status, privacy, uninstall }
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
