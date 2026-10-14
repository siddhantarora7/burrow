import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { PetColor, Species } from '@burrow/core'

export interface BurrowConfig {
  apiUrl: string
  webUrl: string
  petId: string
  token: string
  /** Random per install. Salts the session hash; never leaves this machine. */
  salt: string
  burrows: string[]
  pet: { name: string; species: Species; color: PetColor }
  /** Opt-in: stops also carry token and cost increases. */
  usage?: boolean
  /** The status line that was there before burrow's, run first and restored on uninstall. */
  statusThen?: string
}

export const HOOK_FILE = 'burrow-hook.mjs'
export const STATUS_FILE = 'burrow-statusline.mjs'

export function burrowHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.BURROW_HOME || join(homedir(), '.burrow')
}

export function claudeSettingsPath(env: NodeJS.ProcessEnv = process.env): string {
  return env.CLAUDE_SETTINGS || join(homedir(), '.claude', 'settings.json')
}

export async function readConfig(home: string): Promise<BurrowConfig | null> {
  try {
    const cfg = JSON.parse(await readFile(join(home, 'config.json'), 'utf8')) as BurrowConfig
    return typeof cfg.token === 'string' && typeof cfg.salt === 'string' && typeof cfg.apiUrl === 'string' ? cfg : null
  } catch {
    return null
  }
}

export async function writeConfig(home: string, cfg: BurrowConfig): Promise<void> {
  await mkdir(home, { recursive: true, mode: 0o700 })
  const file = join(home, 'config.json')
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 })
  await chmod(tmp, 0o600)
  await rename(tmp, file)
}
