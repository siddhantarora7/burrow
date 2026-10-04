import { HOOKS } from './settings'

const tty = process.stdout.isTTY && !process.env.NO_COLOR
const wrap = (code: string) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s)
export const dim = wrap('2')
export const bold = wrap('1')
export const green = wrap('32')

export const FACE = { mochi: '(•ᴗ•)', tofu: '[•ᴗ•]', onigiri: '/•ᴗ•\\' } as const

export const SAMPLE_PAYLOAD = '{ "v": 1, "type": "stop", "at": 1791234567890, "session": "3f9a1c0e7b2d" }'

export function privacyBlock(): string {
  return [
    `  each hook sends only this:`,
    ``,
    `    ${bold(SAMPLE_PAYLOAD)}`,
    ``,
    `  ${dim('type     what happened (prompt, stop, needs_input, ...)')}`,
    `  ${dim('at       when')}`,
    `  ${dim('session  a salted hash, so sessions can be told apart but never traced back')}`,
    ``,
    `  never your prompts, code, file paths, repo names, or tool names.`,
  ].join('\n')
}

export function hookTable(): string {
  const rows: Record<string, string> = {
    session_start: 'session_start', prompt: 'prompt', heartbeat: 'heartbeat (at most once a minute)',
    notify: 'needs_input (only when claude is waiting on you)', stop: 'stop', error: 'error', session_end: 'session_end',
  }
  return HOOKS.map(([event, arg]) => `    ${event.padEnd(18)} ${dim('->')} ${rows[arg]}`).join('\n')
}
