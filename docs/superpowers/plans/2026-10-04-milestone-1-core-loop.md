# Milestone 1: Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Claude Code hook fires on a developer's machine, reaches a Cloudflare Durable Object, and one pet in a zen-garden web page reacts live.

**Architecture:** npm-workspaces monorepo. `packages/core` holds the event schema, the pure `derive()` state machine, the wire protocol, and garden spots. `packages/cli` (`burrow-pets`) hatches a pet and installs async command hooks that send only `{v,type,at,session}`. `apps/server` is a Worker with two Durable Objects (PetDO, BurrowDO) using RPC and hibernating WebSockets. `apps/web` is Next.js rendering the garden and deriving pet state client-side from the event stream.

**Tech Stack:** TypeScript 6.0.x, Node ≥ 20 (dev on 24), vitest 5, wrangler 4, Next.js 16 + React 19, Tailwind v4, esbuild (CLI bundling only).

**Spec:** `docs/superpowers/specs/2026-10-04-burrow-design.md`

## Global Constraints

- Hook payload is exactly `{ "v": 1, "type", "at", "session" }`; the server rejects any other key.
- `session` = first 12 hex chars of `sha256(salt + claudeSessionId)`; the raw Claude session id never leaves the machine.
- Hooks are `{"type":"command", ..., "async": true, "timeout": 5}`; never the `http` hook type.
- The hook script always exits 0, prints nothing, and gives up on the network after 3 s.
- The CLI has zero runtime dependencies.
- Approved deps only: `next`, `react`, `react-dom`, `tailwindcss`, `@tailwindcss/postcss`, `typescript@~6.0.3`, `vitest`, `wrangler`, `esbuild`, `@types/node`, `@types/react`, `@types/react-dom`. Ask before adding anything else.
- `derive()` timing: eat 6 s, cheer 3 s, work debounce 15 s, stale running session 10 min, waiting cap 60 min, idle → sleep 20 min.
- Pets animate only `transform` and `opacity`; no SVG filters on pets; `prefers-reduced-motion` shows static poses.
- Visual world: zen garden (spec §9). No soil or underground scenes. Lowercase voice. No em dashes in UI copy.
- Commits: plain messages, no co-author trailer.

## Review Focus

1. **A user's existing `~/.claude/settings.json`** (other hooks, unusual shapes, invalid JSON) must survive `init` and `uninstall` byte-for-byte except burrow's own entries; invalid JSON aborts with no write. Tests in Task 5.
2. **The API is down or the laptop is offline** when a hook fires: the script must return within ~3 s, print nothing, exit 0. Test in Task 4.
3. **Hook stdin is empty, truncated, or not JSON**: still send the event with a stable session hash, never crash. Test in Task 4.
4. **Clock skew** between the server (which stamps `t`) and the viewer's browser: eat/cheer windows must not vanish or stick. Client uses `serverNow` offset. Test in Task 8.
5. **Permission granted after a wave**: the pet must stop waving promptly, not after the 60 s heartbeat throttle. Throttle only consecutive heartbeats (Task 4 test) and treat resumed runs as matured work (Task 2 test).

---

## File Structure

```
package.json                     workspaces, scripts
tsconfig.base.json               shared strict compiler options
vitest.config.ts                 one test run for all workspaces
.gitignore
packages/core/
  package.json  tsconfig.json
  src/index.ts                   re-exports
  src/events.ts                  EVENT_TYPES, WireEvent, Ev, parseWireEvent
  src/ids.ts                     newId, isId, parseToken
  src/species.ts                 SPECIES, PET_COLORS, DEFAULT_COLOR, cleanName
  src/derive.ts                  TIMING, PetState, derive
  src/protocol.ts                Member, BurrowInfo, ServerMsg, ClientMsg
  src/garden.ts                  GARDEN_SPOTS, spotsFor
  test/events.test.ts  test/ids.test.ts  test/species.test.ts  test/derive.test.ts  test/garden.test.ts
packages/cli/                    npm name: burrow-pets
  package.json  tsconfig.json  build.mjs
  src/hook.ts                    pure hook logic + main()
  src/hook-entry.ts              reads stdin, calls main, exits 0
  src/settings.ts                addHooks, removeHooks, updateSettingsFile
  src/config.ts                  BurrowConfig, paths, read/write
  src/ui.ts                      terminal output helpers and copy
  src/cli.ts                     init / status / privacy / uninstall
  test/hook.test.ts  test/settings.test.ts  test/config.test.ts
apps/server/
  package.json  tsconfig.json  wrangler.jsonc
  src/index.ts                   Worker router
  src/logic.ts                   sha256Hex, validateHatch, pruneEvents, allowRate, json helpers
  src/pet.ts                     PetDO
  src/burrow.ts                  BurrowDO
  test/logic.test.ts
apps/web/
  package.json  tsconfig.json  next.config.ts  postcss.config.mjs  next-env.d.ts
  app/layout.tsx  app/globals.css  app/pet.css  app/page.tsx
  app/b/[id]/page.tsx
  components/Pet.tsx             the matte pet rig
  components/Garden.tsx          zen garden scene (SVG)
  components/BurrowView.tsx      live page: connection, tags, a11y list
  lib/sky.ts                     skyAt(hour), season
  lib/burrowState.ts             reducer for ServerMsg
  lib/useBurrow.ts               WebSocket + reconnect
  lib/usePetStates.ts            derive per member, timers
  test/burrowState.test.ts  test/sky.test.ts
scripts/smoke.mjs                end-to-end: CLI init → hook → WebSocket receives event
```

---

### Task 1: Workspace scaffold and core primitives

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/{index,events,ids,species}.ts`
- Test: `packages/core/test/{events,ids,species}.test.ts`

**Interfaces:**
- Produces: `EVENT_TYPES`, `EventType`, `WireEvent`, `Ev` (`WireEvent & { t: number }`), `parseWireEvent(body: unknown): { ok: true; value: WireEvent } | { ok: false; error: string }`; `newId(len?: number): string`, `isId(x: unknown): x is string`, `parseToken(token: string | null | undefined): { petId: string; secret: string } | null`, `SECRET_LEN = 24`; `SPECIES`, `Species`, `PET_COLORS`, `PetColor`, `DEFAULT_COLOR`, `cleanName(raw: unknown): string | null`, `isSpecies`, `isPetColor`.

- [ ] **Step 1: Root files**

`package.json`:
```json
{
  "name": "burrow",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "dev:server": "npm run dev -w @burrow/server",
    "dev:web": "npm run dev -w @burrow/web",
    "build:cli": "npm run build -w burrow-pets",
    "smoke": "node scripts/smoke.mjs"
  },
  "devDependencies": {
    "@types/node": "^24",
    "typescript": "~6.0.3",
    "vitest": "^5.0.3"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true
  }
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    environment: 'node',
  },
})
```

`.gitignore`:
```
node_modules/
dist/
.next/
.wrangler/
.dev.vars
*.log
.DS_Store
worker-configuration.d.ts
next-env.d.ts
```

`packages/core/package.json`:
```json
{
  "name": "@burrow/core",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc -p tsconfig.json" }
}
```

`packages/core/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "lib": ["ES2023", "DOM"] }, "include": ["src", "test"] }
```
(`DOM` only for the global `crypto` type; core uses no DOM APIs.)

- [ ] **Step 2: Write failing tests**

`packages/core/test/events.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseWireEvent } from '../src/events'

const good = { v: 1, type: 'stop', at: 1791234567890, session: '3f9a1c0e7b2d' }

describe('parseWireEvent', () => {
  it('accepts the exact payload', () => {
    expect(parseWireEvent(good)).toEqual({ ok: true, value: good })
  })
  it('rejects any extra key, so the payload can never quietly widen', () => {
    const r = parseWireEvent({ ...good, cwd: '/Users/me/secret-repo' })
    expect(r).toEqual({ ok: false, error: 'unexpected keys: cwd' })
  })
  it.each([
    [null, 'body must be a JSON object'],
    [[], 'body must be a JSON object'],
    [{ ...good, v: 2 }, 'v must be 1'],
    [{ ...good, type: 'tool_use' }, 'unknown type'],
    [{ ...good, at: -1 }, 'at must be epoch ms'],
    [{ ...good, at: 1.5 }, 'at must be epoch ms'],
    [{ ...good, session: 'ABC' }, 'session must be 12 hex chars'],
    [{ v: 1, type: 'stop', at: 1 }, 'session must be 12 hex chars'],
  ])('rejects %j', (body, error) => {
    expect(parseWireEvent(body)).toEqual({ ok: false, error })
  })
})
```

`packages/core/test/ids.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isId, newId, parseToken, SECRET_LEN } from '../src/ids'

describe('ids', () => {
  it('makes 10-char crockford ids', () => {
    for (let i = 0; i < 200; i++) expect(isId(newId())).toBe(true)
  })
  it('never uses ambiguous letters', () => {
    const s = Array.from({ length: 300 }, () => newId(24)).join('')
    expect(s).not.toMatch(/[ilou]/)
  })
  it('parses petId.secret tokens', () => {
    const petId = newId(), secret = newId(SECRET_LEN)
    expect(parseToken(`${petId}.${secret}`)).toEqual({ petId, secret })
  })
  it.each([null, undefined, '', 'nodot', 'abc.def', `${'a'.repeat(10)}.short`])('rejects %j', (t) => {
    expect(parseToken(t)).toBeNull()
  })
})
```

`packages/core/test/species.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { cleanName, DEFAULT_COLOR, PET_COLORS, SPECIES } from '../src/species'

describe('species', () => {
  it('has a default color for every species', () => {
    for (const s of SPECIES) expect(PET_COLORS[DEFAULT_COLOR[s]]).toMatch(/^#[0-9A-F]{6}$/)
  })
  it.each([
    ['  Kiwi ', 'kiwi'],
    ['mr   bean', 'mr bean'],
    ['a', 'a'],
    ['sixteen-chars-ok', 'sixteen-chars-ok'],
  ])('cleans %j', (raw, out) => expect(cleanName(raw)).toBe(out))
  it.each(['', '   ', '-dash', 'seventeen-chars-x', 'emoji🙂', 42, null])('rejects %j', (raw) => {
    expect(cleanName(raw)).toBeNull()
  })
})
```

- [ ] **Step 3: Install and run tests to see them fail**

Run: `npm install && npx vitest run packages/core`
Expected: FAIL, cannot resolve `../src/events` etc.

- [ ] **Step 4: Implement**

`packages/core/src/events.ts`:
```ts
export const EVENT_TYPES = ['session_start', 'prompt', 'heartbeat', 'needs_input', 'stop', 'error', 'session_end'] as const
export type EventType = (typeof EVENT_TYPES)[number]

/** Exactly what a hook sends. Nothing else is ever accepted. */
export interface WireEvent {
  v: 1
  type: EventType
  at: number
  session: string
}

/** A stored event: the wire event plus the server's receive time `t`. */
export interface Ev extends WireEvent {
  t: number
}

const WIRE_KEYS: readonly string[] = ['v', 'type', 'at', 'session']
const SESSION_RE = /^[0-9a-f]{12}$/

export type ParseResult = { ok: true; value: WireEvent } | { ok: false; error: string }

export function isEventType(x: unknown): x is EventType {
  return typeof x === 'string' && (EVENT_TYPES as readonly string[]).includes(x)
}

export function parseWireEvent(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' }
  }
  const extra = Object.keys(body).filter((k) => !WIRE_KEYS.includes(k))
  if (extra.length) return { ok: false, error: `unexpected keys: ${extra.join(', ')}` }
  const b = body as Record<string, unknown>
  if (b.v !== 1) return { ok: false, error: 'v must be 1' }
  if (!isEventType(b.type)) return { ok: false, error: 'unknown type' }
  if (typeof b.at !== 'number' || !Number.isSafeInteger(b.at) || b.at <= 0) {
    return { ok: false, error: 'at must be epoch ms' }
  }
  if (typeof b.session !== 'string' || !SESSION_RE.test(b.session)) {
    return { ok: false, error: 'session must be 12 hex chars' }
  }
  return { ok: true, value: { v: 1, type: b.type, at: b.at, session: b.session } }
}
```

`packages/core/src/ids.ts`:
```ts
// Crockford base32, lowercase: no i, l, o, u.
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'
const CHARS = '[0-9a-hjkmnp-tv-z]'
const ID_RE = new RegExp(`^${CHARS}{10}$`)
export const SECRET_LEN = 24
const SECRET_RE = new RegExp(`^${CHARS}{${SECRET_LEN}}$`)

export function newId(len = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let s = ''
  for (const b of bytes) s += ALPHABET[b & 31]
  return s
}

export function isId(x: unknown): x is string {
  return typeof x === 'string' && ID_RE.test(x)
}

export function parseToken(token: string | null | undefined): { petId: string; secret: string } | null {
  if (!token) return null
  const i = token.indexOf('.')
  if (i < 0) return null
  const petId = token.slice(0, i)
  const secret = token.slice(i + 1)
  return isId(petId) && SECRET_RE.test(secret) ? { petId, secret } : null
}
```

`packages/core/src/species.ts`:
```ts
export const SPECIES = ['mochi', 'tofu', 'onigiri'] as const
export type Species = (typeof SPECIES)[number]

export const PET_COLORS = {
  sakura: '#EFA9BC',
  matcha: '#98B062',
  rice: '#F4EFE4',
  yuzu: '#F0C64E',
  sora: '#A9C8E8',
  fuji: '#BFAEDB',
} as const
export type PetColor = keyof typeof PET_COLORS

export const DEFAULT_COLOR: Record<Species, PetColor> = { mochi: 'sakura', tofu: 'matcha', onigiri: 'rice' }

export const isSpecies = (x: unknown): x is Species => typeof x === 'string' && (SPECIES as readonly string[]).includes(x)
export const isPetColor = (x: unknown): x is PetColor => typeof x === 'string' && x in PET_COLORS

/** Lowercase, single-spaced, 1-16 chars of a-z 0-9 space _ -, starting with a letter or digit. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const n = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  return /^[a-z0-9][a-z0-9 _-]{0,15}$/.test(n) ? n : null
}
```

`packages/core/src/index.ts`:
```ts
export * from './events'
export * from './ids'
export * from './species'
```

- [ ] **Step 5: Run tests to see them pass**

Run: `npx vitest run packages/core && npm run typecheck -w @burrow/core`
Expected: all PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json vitest.config.ts .gitignore packages/core
git commit -m "core: workspace scaffold, event schema, ids, species"
```

---

### Task 2: The `derive()` state machine

**Files:**
- Create: `packages/core/src/derive.ts`; Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/derive.test.ts`

**Interfaces:**
- Consumes: `Ev`, `EventType` from Task 1.
- Produces:
```ts
export const TIMING: { eatMs: 6000; cheerMs: 3000; workDebounceMs: 15000; staleMs: 600000; waitMaxMs: 3600000; idleMs: 1200000 }
export type PetState = 'idle' | 'eat' | 'wave' | 'work' | 'sleep' | 'cheer'
export const PET_STATES: readonly PetState[]
export interface DeriveInput { events: readonly Ev[]; friendStops?: readonly number[]; now: number }
export interface DeriveResult { state: PetState; lastEventAt: number | null; nextChangeAt: number | null }
export function derive(input: DeriveInput): DeriveResult
```
Note for the spec: `since` became `lastEventAt` (the UI needs "agent finished 2 min ago", which is the event time; "since" was ill-defined for idle). Update spec §6 in Step 6.

Rules (spec §6, refined here):
- Per session, the latest event decides the phase: `session_start` → open, `prompt`/`heartbeat` → running, `needs_input`/`error` → waiting, `stop` → done, `session_end` → ended.
- Running sessions with no event for `staleMs` are ignored. Waiting sessions older than `waitMaxMs` are ignored.
- A running session is "work" once `now - runStart >= workDebounceMs`, where `runStart` is the latest `prompt` in that session, or (if there is none) the first event of the trailing run of running events. So a run resumed after a permission prompt is already mature.
- Priority: wave > eat > work > idle > sleep. Cheer replaces work or idle for `cheerMs` after the latest friend stop.
- `nextChangeAt` may be early, never late: the state is constant on `[now, nextChangeAt)`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/derive.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { derive, TIMING, type PetState } from '../src/derive'
import type { Ev, EventType } from '../src/events'

const T0 = 1_791_000_000_000
const S = 1000, MIN = 60 * S
const ev = (type: EventType, t: number, session = 'aaaaaaaaaaaa'): Ev => ({ v: 1, type, at: t, session, t })
const at = (events: Ev[], now: number, friendStops: number[] = []) => derive({ events, now, friendStops })

describe('derive: single rules', () => {
  it('no events: asleep, nothing scheduled', () => {
    expect(at([], T0)).toEqual({ state: 'sleep', lastEventAt: null, nextChangeAt: null })
  })
  it('session_start alone is activity, not work', () => {
    expect(at([ev('session_start', T0)], T0 + S).state).toBe('idle')
  })
  it('a fresh prompt shows idle until the work debounce matures', () => {
    const r = at([ev('prompt', T0)], T0 + 5 * S)
    expect(r.state).toBe('idle')
    expect(r.nextChangeAt).toBe(T0 + TIMING.workDebounceMs)
  })
  it('a run of 15 s or more is work', () => {
    expect(at([ev('prompt', T0)], T0 + 15 * S).state).toBe('work')
  })
  it('heartbeats keep a long run working', () => {
    const events = [ev('prompt', T0), ev('heartbeat', T0 + 8 * MIN), ev('heartbeat', T0 + 17 * MIN)]
    expect(at(events, T0 + 26 * MIN).state).toBe('work')
  })
  it('a running session silent for 10 min is stale: idle, then asleep at 20 min', () => {
    const events = [ev('prompt', T0)]
    expect(at(events, T0 + 10 * MIN).state).toBe('idle')
    expect(at(events, T0 + 20 * MIN).state).toBe('sleep')
  })
  it('stop: eats for 6 s, then idles', () => {
    const events = [ev('prompt', T0), ev('stop', T0 + 30 * S)]
    const r = at(events, T0 + 32 * S)
    expect(r).toMatchObject({ state: 'eat', lastEventAt: T0 + 30 * S, nextChangeAt: T0 + 36 * S })
    expect(at(events, T0 + 36 * S).state).toBe('idle')
  })
  it('needs_input waves', () => {
    expect(at([ev('prompt', T0), ev('needs_input', T0 + 20 * S)], T0 + 21 * S).state).toBe('wave')
  })
  it('error waves too: the agent needs you', () => {
    expect(at([ev('prompt', T0), ev('error', T0 + 20 * S)], T0 + 21 * S).state).toBe('wave')
  })
  it('a wave left unanswered for 60 min stops (crashed or abandoned session)', () => {
    const events = [ev('needs_input', T0)]
    expect(at(events, T0 + 59 * MIN).state).toBe('wave')
    expect(at(events, T0 + 60 * MIN).state).toBe('sleep')
  })
  it('session_end is activity: idle, asleep after 20 min', () => {
    const events = [ev('stop', T0), ev('session_end', T0 + MIN)]
    expect(at(events, T0 + 2 * MIN).state).toBe('idle')
    expect(at(events, T0 + 21 * MIN).state).toBe('sleep')
  })
})

describe('derive: priorities and sessions', () => {
  it('wave beats eat beats work', () => {
    const a = 'aaaaaaaaaaaa', b = 'bbbbbbbbbbbb', c = 'cccccccccccc'
    const events = [ev('prompt', T0, a), ev('prompt', T0, b), ev('stop', T0 + 60 * S, b), ev('needs_input', T0 + 61 * S, c)]
    expect(at(events, T0 + 62 * S).state).toBe('wave')
    expect(at(events.slice(0, 3), T0 + 62 * S).state).toBe('eat')
    expect(at(events.slice(0, 1), T0 + 62 * S).state).toBe('work')
  })
  it('one session done, another still running: work', () => {
    const events = [ev('prompt', T0, 'aaaaaaaaaaaa'), ev('stop', T0 + 10 * S, 'aaaaaaaaaaaa'), ev('prompt', T0, 'bbbbbbbbbbbb')]
    expect(at(events, T0 + 40 * S).state).toBe('work')
  })
  it('permission granted after a wave: back to work immediately, no new debounce', () => {
    const events = [ev('prompt', T0), ev('needs_input', T0 + MIN), ev('heartbeat', T0 + 2 * MIN)]
    expect(at(events, T0 + 2 * MIN + S).state).toBe('work')
  })
  it('ignores events from the future', () => {
    expect(at([ev('stop', T0 + MIN)], T0).state).toBe('sleep')
  })
  it('does not depend on input order; ties break on `at`', () => {
    const a = ev('prompt', T0)
    const b: Ev = { ...ev('stop', T0), at: T0 + 1 }
    expect(at([b, a], T0 + S).state).toBe('eat')
    expect(at([a, b], T0 + S).state).toBe('eat')
  })
})

describe('derive: cheer', () => {
  it('cheers for 3 s when a friend ships while idle or working', () => {
    expect(at([ev('session_start', T0)], T0 + 10 * S, [T0 + 9 * S]).state).toBe('cheer')
    expect(at([ev('prompt', T0)], T0 + 60 * S, [T0 + 59 * S]).state).toBe('cheer')
    const r = at([ev('session_start', T0)], T0 + 10 * S, [T0 + 9 * S])
    expect(r.nextChangeAt).toBe(T0 + 12 * S)
    expect(at([ev('session_start', T0)], T0 + 12 * S, [T0 + 9 * S]).state).toBe('idle')
  })
  it('waving and eating pets do not cheer, sleeping pets stay asleep', () => {
    expect(at([ev('needs_input', T0)], T0 + S, [T0]).state).toBe('wave')
    expect(at([ev('stop', T0)], T0 + S, [T0]).state).toBe('eat')
    expect(at([], T0 + S, [T0]).state).toBe('sleep')
  })
})

describe('derive: nextChangeAt is never late (property)', () => {
  // Small seeded PRNG so failures reproduce.
  function rng(seed: number) {
    return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  }
  const TYPES: EventType[] = ['session_start', 'prompt', 'heartbeat', 'needs_input', 'stop', 'error', 'session_end']
  it('state is constant on [now, nextChangeAt)', () => {
    const rand = rng(42)
    for (let trial = 0; trial < 3000; trial++) {
      const events: Ev[] = []
      let t = T0
      const n = Math.floor(rand() * 8)
      for (let i = 0; i < n; i++) {
        t += Math.floor(rand() * 25 * MIN)
        const type = TYPES[Math.floor(rand() * TYPES.length)]!
        events.push(ev(type, t, rand() < 0.5 ? 'aaaaaaaaaaaa' : 'bbbbbbbbbbbb'))
      }
      const friendStops = rand() < 0.3 ? [t + Math.floor(rand() * 5 * S)] : []
      const now = t + Math.floor(rand() * 90 * MIN)
      const r = at(events, now, friendStops)
      const horizon = r.nextChangeAt ?? now + 24 * 60 * MIN
      expect(horizon).toBeGreaterThan(now)
      for (const p of [now + 1, Math.floor((now + horizon) / 2), horizon - 1]) {
        const s: PetState = at(events, p, friendStops).state
        expect(s, `trial ${trial} at +${p - now}ms`).toBe(r.state)
      }
    }
  })
})
```

- [ ] **Step 2: Run to see failure**

Run: `npx vitest run packages/core/test/derive.test.ts`
Expected: FAIL, cannot resolve `../src/derive`.

- [ ] **Step 3: Implement**

`packages/core/src/derive.ts`:
```ts
import type { Ev, EventType } from './events'

export const TIMING = {
  eatMs: 6_000,
  cheerMs: 3_000,
  workDebounceMs: 15_000,
  staleMs: 10 * 60_000,
  waitMaxMs: 60 * 60_000,
  idleMs: 20 * 60_000,
} as const

export type PetState = 'idle' | 'eat' | 'wave' | 'work' | 'sleep' | 'cheer'
export const PET_STATES: readonly PetState[] = ['idle', 'eat', 'wave', 'work', 'sleep', 'cheer']

export interface DeriveInput {
  events: readonly Ev[]
  /** Server times of friends' `stop` events (for cheer). */
  friendStops?: readonly number[]
  now: number
}

export interface DeriveResult {
  state: PetState
  lastEventAt: number | null
  /** Earliest instant the state could change with no new event. May be early, never late. */
  nextChangeAt: number | null
}

type Phase = 'open' | 'running' | 'waiting' | 'done' | 'ended'
const PHASE: Record<EventType, Phase> = {
  session_start: 'open',
  prompt: 'running',
  heartbeat: 'running',
  needs_input: 'waiting',
  error: 'waiting',
  stop: 'done',
  session_end: 'ended',
}

const byTime = (a: Ev, b: Ev) => a.t - b.t || a.at - b.at

export function derive({ events, friendStops = [], now }: DeriveInput): DeriveResult {
  const past = events.filter((e) => e.t <= now).sort(byTime)
  const upcoming: number[] = []
  const later = (x: number) => {
    if (x > now) upcoming.push(x)
  }

  const last = past[past.length - 1]
  const lastEventAt = last ? last.t : null

  const sessions = new Map<string, Ev[]>()
  for (const e of past) {
    const list = sessions.get(e.session)
    if (list) list.push(e)
    else sessions.set(e.session, [e])
  }

  let waiting = false
  let working = false
  for (const evs of sessions.values()) {
    const tail = evs[evs.length - 1]!
    const phase = PHASE[tail.type]
    if (phase === 'waiting') {
      const end = tail.t + TIMING.waitMaxMs
      if (now < end) {
        waiting = true
        later(end)
      }
    } else if (phase === 'running') {
      const staleAt = tail.t + TIMING.staleMs
      if (now < staleAt) {
        later(staleAt)
        const runStart = runStartOf(evs)
        const matureAt = runStart + TIMING.workDebounceMs
        if (now >= matureAt) working = true
        else later(matureAt)
      }
    }
  }

  let lastStop: number | null = null
  for (const e of past) if (e.type === 'stop') lastStop = e.t
  const eating = lastStop !== null && now < lastStop + TIMING.eatMs
  if (lastStop !== null) later(lastStop + TIMING.eatMs)

  const active = lastEventAt !== null && now < lastEventAt + TIMING.idleMs
  if (lastEventAt !== null) later(lastEventAt + TIMING.idleMs)

  let state: PetState = waiting ? 'wave' : eating ? 'eat' : working ? 'work' : active ? 'idle' : 'sleep'

  let friend: number | null = null
  for (const f of friendStops) if (f <= now && (friend === null || f > friend)) friend = f
  if (friend !== null) {
    later(friend + TIMING.cheerMs)
    if ((state === 'work' || state === 'idle') && now < friend + TIMING.cheerMs) state = 'cheer'
  }

  return { state, lastEventAt, nextChangeAt: upcoming.length ? Math.min(...upcoming) : null }
}

/** Latest prompt in the session; else the first event of the trailing run of running events. */
function runStartOf(evs: readonly Ev[]): number {
  for (let i = evs.length - 1; i >= 0; i--) if (evs[i]!.type === 'prompt') return evs[i]!.t
  let i = evs.length - 1
  while (i > 0 && PHASE[evs[i - 1]!.type] === 'running') i--
  return evs[i]!.t
}
```

Add to `packages/core/src/index.ts`:
```ts
export * from './derive'
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run packages/core`
Expected: all PASS (property test: 3000 trials).

- [ ] **Step 5: Update spec §6 signature**

In `docs/superpowers/specs/2026-10-04-burrow-design.md`, replace the line
`derive(input: { events: Ev[]; friendStops: number[]; now: number }): { state: PetState; since: number; nextChangeAt: number | null }`
with
`derive(input: { events: Ev[]; friendStops?: number[]; now: number }): { state: PetState; lastEventAt: number | null; nextChangeAt: number | null }`
and add under the rules table: "Waiting sessions older than 60 min and running sessions silent for 10 min are ignored. A run resumed after a permission prompt counts from its latest `prompt`, so it is already work."

- [ ] **Step 6: Commit**

```bash
git add packages/core docs/superpowers/specs/2026-10-04-burrow-design.md
git commit -m "core: deterministic derive() state machine with property test"
```

---

### Task 3: Wire protocol and garden spots

**Files:**
- Create: `packages/core/src/protocol.ts`, `packages/core/src/garden.ts`; Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/garden.test.ts`

**Interfaces:**
- Produces:
```ts
// protocol.ts
export type EnvName = 'garden'
export interface MemberProfile { petId: string; name: string; species: Species; color: PetColor }
export interface Member extends MemberProfile { joinedAt: number; mealsTotal: number; events: Ev[] }
export interface BurrowInfo { id: string; name: string; env: EnvName; createdAt: number; createdBy: string }
export type ServerMsg =
  | { t: 'snapshot'; burrow: BurrowInfo; members: Member[]; serverNow: number }
  | { t: 'event'; petId: string; ev: Ev; serverNow: number }
  | { t: 'member'; member: Member; serverNow: number }
  | { t: 'error'; code: 'not_found' }
export type ClientMsg = { t: 'hello' }
export const MAX_MEMBER_EVENTS = 50
export const EVENT_RETENTION_MS = 24 * 60 * 60 * 1000
// garden.ts
export interface Spot { x: number; y: number; scale: number }   // x,y in the 1600x1000 desktop viewBox; y = stone center
export const GARDEN_VIEWBOX: { w: 1600; h: 1000 }
export const GARDEN_SPOTS: readonly Spot[]
export function spotsFor(count: number): Spot[]
```

- [ ] **Step 1: Failing test**

`packages/core/test/garden.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { GARDEN_SPOTS, GARDEN_VIEWBOX, spotsFor } from '../src/garden'

describe('garden spots', () => {
  it('returns exactly as many spots as members, in a stable order', () => {
    expect(spotsFor(0)).toEqual([])
    expect(spotsFor(3)).toEqual(GARDEN_SPOTS.slice(0, 3))
    expect(spotsFor(5)).toEqual(spotsFor(5))
  })
  it('keeps every spot inside the scene and on the gravel', () => {
    for (const s of GARDEN_SPOTS) {
      expect(s.x).toBeGreaterThan(80)
      expect(s.x).toBeLessThan(GARDEN_VIEWBOX.w - 80)
      expect(s.y).toBeGreaterThan(470)
      expect(s.y).toBeLessThan(GARDEN_VIEWBOX.h - 40)
    }
  })
  it('caps at the defined spots for milestone 1', () => {
    expect(spotsFor(40)).toHaveLength(GARDEN_SPOTS.length)
  })
})
```

- [ ] **Step 2: Run, see failure** — `npx vitest run packages/core/test/garden.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

`packages/core/src/protocol.ts`:
```ts
import type { Ev } from './events'
import type { PetColor, Species } from './species'

export type EnvName = 'garden'

export interface MemberProfile {
  petId: string
  name: string
  species: Species
  color: PetColor
}

export interface Member extends MemberProfile {
  joinedAt: number
  mealsTotal: number
  events: Ev[]
}

export interface BurrowInfo {
  id: string
  name: string
  env: EnvName
  createdAt: number
  createdBy: string
}

export type ServerMsg =
  | { t: 'snapshot'; burrow: BurrowInfo; members: Member[]; serverNow: number }
  | { t: 'event'; petId: string; ev: Ev; serverNow: number }
  | { t: 'member'; member: Member; serverNow: number }
  | { t: 'error'; code: 'not_found' }

export type ClientMsg = { t: 'hello' }

export const MAX_MEMBER_EVENTS = 50
export const EVENT_RETENTION_MS = 24 * 60 * 60 * 1000
```

`packages/core/src/garden.ts`:
```ts
export interface Spot {
  /** Stone center in the 1600x1000 desktop viewBox. */
  x: number
  y: number
  /** Depth scale: stones nearer the wall are smaller. */
  scale: number
}

export const GARDEN_VIEWBOX = { w: 1600, h: 1000 } as const

// Front row first, so a small burrow fills the foreground around the pond.
export const GARDEN_SPOTS: readonly Spot[] = [
  { x: 380, y: 700, scale: 1 },
  { x: 1220, y: 700, scale: 1 },
  { x: 640, y: 870, scale: 1.05 },
  { x: 980, y: 880, scale: 1.05 },
  { x: 190, y: 880, scale: 1.05 },
  { x: 1420, y: 880, scale: 1.05 },
  { x: 560, y: 545, scale: 0.82 },
  { x: 1050, y: 545, scale: 0.82 },
  { x: 805, y: 505, scale: 0.76 },
]

export function spotsFor(count: number): Spot[] {
  return GARDEN_SPOTS.slice(0, Math.max(0, count))
}
```

Add to `index.ts`:
```ts
export * from './protocol'
export * from './garden'
```

- [ ] **Step 4: Run** — `npx vitest run packages/core && npm run typecheck -w @burrow/core` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "core: wire protocol types and garden spots"
```

---

### Task 4: The hook script (privacy-critical)

**Files:**
- Create: `packages/cli/package.json`, `packages/cli/tsconfig.json`, `packages/cli/src/config.ts`, `packages/cli/src/hook.ts`, `packages/cli/src/hook-entry.ts`
- Test: `packages/cli/test/hook.test.ts`, `packages/cli/test/config.test.ts`

**Interfaces:**
- Consumes: `EventType`, `WireEvent`, `Species`, `PetColor` from core.
- Produces:
```ts
// config.ts
export interface BurrowConfig { apiUrl: string; webUrl: string; petId: string; token: string; salt: string; burrows: string[]; pet: { name: string; species: Species; color: PetColor } }
export function burrowHome(env?: NodeJS.ProcessEnv): string            // $BURROW_HOME or ~/.burrow
export function claudeSettingsPath(env?: NodeJS.ProcessEnv): string    // $CLAUDE_SETTINGS or ~/.claude/settings.json
export const HOOK_FILE = 'burrow-hook.mjs'
export async function readConfig(home: string): Promise<BurrowConfig | null>
export async function writeConfig(home: string, cfg: BurrowConfig): Promise<void>   // mode 0600
// hook.ts
export const HOOK_ARGS: readonly ['session_start','prompt','heartbeat','notify','stop','error','session_end']
export type HookArg = (typeof HOOK_ARGS)[number]
export interface HookInput { session_id?: string; notification_type?: string }
export interface LastSent { type: EventType; at: number }
export const HEARTBEAT_MIN_MS = 60_000
export function pickInput(raw: string): HookInput
export function eventTypeFor(arg: string, input: HookInput): EventType | null
export function sessionHash(salt: string, sessionId: string): string
export function shouldSend(type: EventType, last: LastSent | null, now: number): boolean
export async function runHook(opts: { arg: string; stdin: string; env: NodeJS.ProcessEnv; now?: number }): Promise<WireEvent | null>  // returns what it sent (or null)
```

- [ ] **Step 1: Package files**

`packages/cli/package.json`:
```json
{
  "name": "burrow-pets",
  "version": "0.1.0",
  "description": "A tiny pet that reacts live to Claude Code, in a garden shared with your friends.",
  "license": "MIT",
  "type": "module",
  "bin": { "burrow-pets": "dist/cli.mjs" },
  "files": ["dist"],
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "node build.mjs",
    "typecheck": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "@burrow/core": "*",
    "esbuild": "^0.28.2"
  }
}
```

`packages/cli/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "types": ["node"] }, "include": ["src", "test"] }
```

- [ ] **Step 2: Failing tests**

`packages/cli/test/config.test.ts`:
```ts
import { mkdtemp, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { burrowHome, readConfig, writeConfig, type BurrowConfig } from '../src/config'

const cfg: BurrowConfig = {
  apiUrl: 'http://127.0.0.1:8787', webUrl: 'http://localhost:3000', petId: 'abcdefghjk',
  token: 'abcdefghjk.abcdefghjkmnpqrstvwxyz012', salt: '00'.repeat(16), burrows: ['mnpqrstvwx'],
  pet: { name: 'kiwi', species: 'mochi', color: 'sakura' },
}

describe('config', () => {
  it('honors BURROW_HOME', () => {
    expect(burrowHome({ BURROW_HOME: '/tmp/x' })).toBe('/tmp/x')
  })
  it('round-trips and is private to the user', async () => {
    const home = await mkdtemp(join(tmpdir(), 'burrow-'))
    await writeConfig(home, cfg)
    expect(await readConfig(home)).toEqual(cfg)
    expect((await stat(join(home, 'config.json'))).mode & 0o777).toBe(0o600)
  })
  it('returns null when missing or corrupt', async () => {
    const home = await mkdtemp(join(tmpdir(), 'burrow-'))
    expect(await readConfig(home)).toBeNull()
  })
})
```

`packages/cli/test/hook.test.ts`:
```ts
import { mkdtemp, readdir } from 'node:fs/promises'
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

async function setup(apiUrl = 'http://api.test') {
  const home = await mkdtemp(join(tmpdir(), 'burrow-hook-'))
  await writeConfig(home, {
    apiUrl, webUrl: 'http://web.test', petId: 'abcdefghjk', token: 'abcdefghjk.abcdefghjkmnpqrstvwxyz012',
    salt: SALT, burrows: [], pet: { name: 'kiwi', species: 'mochi', color: 'sakura' },
  })
  return { BURROW_HOME: home }
}

afterEach(() => vi.unstubAllGlobals())

describe('pickInput', () => {
  it('keeps only session_id and notification_type', () => {
    expect(pickInput(fullClaudeInput)).toEqual({
      session_id: '6c7f2a10-0000-4000-8000-123456789abc',
      notification_type: 'permission_prompt',
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
```

- [ ] **Step 3: Run, see failure** — `npm install && npx vitest run packages/cli` → FAIL (modules missing).

- [ ] **Step 4: Implement**

`packages/cli/src/config.ts`:
```ts
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
}

export const HOOK_FILE = 'burrow-hook.mjs'

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
```

`packages/cli/src/hook.ts`:
```ts
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
```

`packages/cli/src/hook-entry.ts`:
```ts
import { runHook } from './hook'

function readStdin(timeoutMs: number): Promise<string> {
  if (process.stdin.isTTY) return Promise.resolve('')
  return new Promise((resolve) => {
    let data = ''
    const done = () => resolve(data)
    const timer = setTimeout(done, timeoutMs)
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => {
      if (data.length < 1_000_000) data += c
    })
    process.stdin.on('end', () => {
      clearTimeout(timer)
      done()
    })
    process.stdin.on('error', done)
  })
}

readStdin(1000)
  .then((stdin) => runHook({ arg: process.argv[2] ?? '', stdin, env: process.env }))
  .catch(() => {})
  .finally(() => process.exit(0))
```

- [ ] **Step 5: Run** — `npx vitest run packages/cli` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/cli package-lock.json
git commit -m "cli: privacy-minimal hook script with throttled heartbeats"
```

---

### Task 5: Safe Claude settings merge

**Files:**
- Create: `packages/cli/src/settings.ts`
- Test: `packages/cli/test/settings.test.ts`

**Interfaces:**
- Consumes: `HookArg` (Task 4), `HOOK_FILE` (Task 4).
- Produces:
```ts
export const HOOKS: ReadonlyArray<readonly [claudeEvent: string, arg: HookArg]>
export function hookCommand(scriptPath: string, arg: HookArg): string
export function isBurrowHook(h: unknown): boolean
export function addHooks(settings: unknown, scriptPath: string): { settings: Record<string, unknown>; added: string[] }
export function removeHooks(settings: unknown): { settings: Record<string, unknown>; removed: number }
export class SettingsError extends Error {}
export async function updateSettingsFile(path: string, backupDir: string, fn: (s: unknown) => Record<string, unknown>): Promise<{ backup: string | null }>
```

- [ ] **Step 1: Failing tests**

`packages/cli/test/settings.test.ts`:
```ts
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addHooks, HOOKS, hookCommand, removeHooks, SettingsError, updateSettingsFile } from '../src/settings'

const SCRIPT = '/Users/me/.burrow/burrow-hook.mjs'
const userSettings = {
  model: 'opus',
  hooks: {
    Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }],
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: './guard.sh' }] }],
  },
  permissions: { allow: ['Bash(npm test)'] },
}

describe('addHooks', () => {
  it('adds one async command hook per event and keeps everything else', () => {
    const { settings, added } = addHooks(structuredClone(userSettings), SCRIPT)
    expect(added).toEqual(HOOKS.map(([e]) => e))
    const hooks = settings.hooks as Record<string, Array<{ hooks: Array<Record<string, unknown>> }>>
    expect(hooks.Stop).toHaveLength(2)
    expect(hooks.Stop![0]).toEqual(userSettings.hooks.Stop[0])
    expect(hooks.Stop![1]!.hooks[0]).toEqual({ type: 'command', command: hookCommand(SCRIPT, 'stop'), async: true, timeout: 5 })
    expect(hooks.PreToolUse).toEqual(userSettings.hooks.PreToolUse)
    expect(settings.model).toBe('opus')
    expect(settings.permissions).toEqual(userSettings.permissions)
  })
  it('is idempotent', () => {
    const once = addHooks(structuredClone(userSettings), SCRIPT).settings
    const twice = addHooks(structuredClone(once), SCRIPT)
    expect(twice.added).toEqual([])
    expect(twice.settings).toEqual(once)
  })
  it('works on empty settings', () => {
    expect(addHooks({}, SCRIPT).added).toHaveLength(HOOKS.length)
  })
  it('never uses the http hook type', () => {
    expect(JSON.stringify(addHooks({}, SCRIPT).settings)).not.toContain('"http"')
  })
  it.each([[[]], ['str'], [{ hooks: [] }], [{ hooks: { Stop: {} } }]])('refuses odd shapes %j', (s) => {
    expect(() => addHooks(s, SCRIPT)).toThrow(SettingsError)
  })
})

describe('removeHooks', () => {
  it('restores the original settings exactly', () => {
    const withHooks = addHooks(structuredClone(userSettings), SCRIPT).settings
    const { settings, removed } = removeHooks(withHooks)
    expect(removed).toBe(HOOKS.length)
    expect(settings).toEqual(userSettings)
  })
  it('drops the hooks key when burrow was the only user of it', () => {
    const { settings } = removeHooks(addHooks({ model: 'x' }, SCRIPT).settings)
    expect(settings).toEqual({ model: 'x' })
  })
})

describe('updateSettingsFile', () => {
  it('backs up, then writes 2-space JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'burrow-set-'))
    const file = join(dir, 'settings.json')
    await writeFile(file, JSON.stringify(userSettings))
    const { backup } = await updateSettingsFile(file, join(dir, 'backups'), (s) => addHooks(s, SCRIPT).settings)
    expect(backup).not.toBeNull()
    expect(JSON.parse(await readFile(backup!, 'utf8'))).toEqual(userSettings)
    const written = await readFile(file, 'utf8')
    expect(written).toMatch(/^\{\n  "model"/)
    expect(written.endsWith('\n')).toBe(true)
  })
  it('creates the file (and its folder) when missing, with no backup', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'burrow-set-'))
    const file = join(dir, 'nested', 'settings.json')
    const { backup } = await updateSettingsFile(file, join(dir, 'backups'), (s) => addHooks(s, SCRIPT).settings)
    expect(backup).toBeNull()
    expect(Object.keys(JSON.parse(await readFile(file, 'utf8')).hooks)).toHaveLength(HOOKS.length)
  })
  it('refuses invalid JSON and leaves the file untouched', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'burrow-set-'))
    const file = join(dir, 'settings.json')
    const broken = '{ "model": "opus", // a comment\n}'
    await writeFile(file, broken)
    await expect(updateSettingsFile(file, join(dir, 'b'), (s) => addHooks(s, SCRIPT).settings)).rejects.toThrow(SettingsError)
    expect(await readFile(file, 'utf8')).toBe(broken)
    expect(await readdir(dir)).toEqual(['settings.json'])
  })
})
```

- [ ] **Step 2: Run, see failure** — `npx vitest run packages/cli/test/settings.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`packages/cli/src/settings.ts`:
```ts
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { HOOK_FILE } from './config'
import type { HookArg } from './hook'

export class SettingsError extends Error {}

/** Claude Code hook event → the arg our script receives. Verified against code.claude.com/docs/en/hooks (2026-10-04). */
export const HOOKS: ReadonlyArray<readonly [string, HookArg]> = [
  ['SessionStart', 'session_start'],
  ['UserPromptSubmit', 'prompt'],
  ['PostToolBatch', 'heartbeat'],
  ['Notification', 'notify'],
  ['Stop', 'stop'],
  ['StopFailure', 'error'],
  ['SessionEnd', 'session_end'],
]

export function hookCommand(scriptPath: string, arg: HookArg): string {
  return `node "${scriptPath}" ${arg}`
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

export function isBurrowHook(h: unknown): boolean {
  return isObj(h) && typeof h.command === 'string' && h.command.includes(HOOK_FILE)
}

function hooksObject(settings: unknown): { root: Record<string, unknown>; hooks: Record<string, unknown> } {
  if (!isObj(settings)) throw new SettingsError('settings.json must contain a JSON object')
  const root = settings
  if (root.hooks === undefined) return { root, hooks: {} }
  if (!isObj(root.hooks)) throw new SettingsError('"hooks" in settings.json is not an object')
  for (const [k, v] of Object.entries(root.hooks)) {
    if (!Array.isArray(v)) throw new SettingsError(`"hooks.${k}" in settings.json is not a list`)
  }
  return { root, hooks: root.hooks }
}

export function addHooks(settings: unknown, scriptPath: string): { settings: Record<string, unknown>; added: string[] } {
  const { root, hooks } = hooksObject(settings)
  const added: string[] = []
  for (const [event, arg] of HOOKS) {
    const groups = (hooks[event] as unknown[] | undefined) ?? []
    const present = groups.some((g) => isObj(g) && Array.isArray(g.hooks) && g.hooks.some(isBurrowHook))
    if (present) continue
    groups.push({ hooks: [{ type: 'command', command: hookCommand(scriptPath, arg), async: true, timeout: 5 }] })
    hooks[event] = groups
    added.push(event)
  }
  return { settings: { ...root, hooks }, added }
}

export function removeHooks(settings: unknown): { settings: Record<string, unknown>; removed: number } {
  const { root, hooks } = hooksObject(settings)
  let removed = 0
  for (const [event, value] of Object.entries(hooks)) {
    const groups = (value as unknown[]).flatMap((g) => {
      if (!isObj(g) || !Array.isArray(g.hooks)) return [g]
      const kept = g.hooks.filter((h) => !isBurrowHook(h))
      removed += g.hooks.length - kept.length
      return kept.length ? [{ ...g, hooks: kept }] : []
    })
    if (groups.length) hooks[event] = groups
    else delete hooks[event]
  }
  const out: Record<string, unknown> = { ...root, hooks }
  if (Object.keys(hooks).length === 0) delete out.hooks
  return { settings: out, removed }
}

export async function updateSettingsFile(
  path: string,
  backupDir: string,
  fn: (s: unknown) => Record<string, unknown>,
): Promise<{ backup: string | null }> {
  let raw: string | null = null
  try {
    raw = await readFile(path, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
  let current: unknown = {}
  if (raw !== null && raw.trim() !== '') {
    try {
      current = JSON.parse(raw)
    } catch {
      throw new SettingsError(`${path} is not valid JSON. burrow left it untouched. Fix it, then run init again.`)
    }
  }
  const next = fn(current)
  let backup: string | null = null
  if (raw !== null) {
    await mkdir(backupDir, { recursive: true })
    backup = join(backupDir, `settings.backup.${Date.now()}.json`)
    await copyFile(path, backup)
  }
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.burrow.tmp`
  await writeFile(tmp, JSON.stringify(next, null, 2) + '\n')
  await rename(tmp, path)
  return { backup }
}
```

- [ ] **Step 4: Run** — `npx vitest run packages/cli` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli
git commit -m "cli: idempotent, reversible Claude settings merge with backups"
```

---

### Task 6: Server (Worker + PetDO + BurrowDO)

**Files:**
- Create: `apps/server/{package.json,tsconfig.json,wrangler.jsonc}`, `apps/server/src/{logic,pet,burrow,index}.ts`
- Test: `apps/server/test/logic.test.ts`

**Interfaces:**
- Consumes: `parseWireEvent`, `parseToken`, `newId`, `SECRET_LEN`, `cleanName`, `isSpecies`, `isPetColor`, `DEFAULT_COLOR`, `Ev`, `Member`, `MemberProfile`, `BurrowInfo`, `ServerMsg`, `MAX_MEMBER_EVENTS`, `EVENT_RETENTION_MS` from core.
- Produces (HTTP, consumed by the CLI in Task 7 and smoke test in Task 9):
  - `POST /v1/pets` body `{ name, species, color?, tz? }` → `201 { petId, token, burrowId }`; `400 { error }`.
  - `POST /v1/events` header `Authorization: Bearer <token>`, body `WireEvent` → `204`; `400 { error }`; `401 { error: 'bad token' }`; `429 { error: 'slow down' }`.
  - `GET /v1/burrows/:id/ws` → WebSocket; first message is a `ServerMsg` snapshot, or `{t:'error',code:'not_found'}` then close 4404.
- `logic.ts` exports: `sha256Hex(s: string): Promise<string>`, `validateHatch(body: unknown): { ok: true; value: { name: string; species: Species; color: PetColor; tz: string } } | { ok: false; error: string }`, `pruneEvents(events: Ev[], now: number): Ev[]`, `allowRate(stamps: number[], now: number, limit: number, windowMs: number): { ok: boolean; stamps: number[] }`, `json(body: unknown, status?: number, headers?: HeadersInit): Response`, `localDate(t: number, tz: string): string`.

- [ ] **Step 1: Package files**

`apps/server/package.json`:
```json
{
  "name": "@burrow/server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev --port 8787 --ip 127.0.0.1",
    "deploy": "wrangler deploy",
    "types": "wrangler types",
    "typecheck": "wrangler types && tsc -p tsconfig.json"
  },
  "devDependencies": { "@burrow/core": "*", "wrangler": "^4.147.0" }
}
```

`apps/server/wrangler.jsonc`:
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "burrow-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-01",
  "durable_objects": {
    "bindings": [
      { "name": "PET", "class_name": "PetDO" },
      { "name": "BURROW", "class_name": "BurrowDO" }
    ]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["PetDO", "BurrowDO"] }],
  "vars": { "WEB_ORIGIN": "http://localhost:3000" }
}
```

`apps/server/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2023"], "types": ["./worker-configuration.d.ts"] },
  "include": ["src", "test", "worker-configuration.d.ts"]
}
```
(`test/logic.test.ts` uses only `crypto.subtle`, `Response`, and `Intl`, all present in Node 24 and Workers.)

- [ ] **Step 2: Failing tests**

`apps/server/test/logic.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Ev } from '@burrow/core'
import { allowRate, localDate, pruneEvents, sha256Hex, validateHatch } from '../src/logic'

describe('sha256Hex', () => {
  it('matches the known vector', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('validateHatch', () => {
  it('cleans and defaults', () => {
    expect(validateHatch({ name: ' Kiwi ', species: 'tofu' })).toEqual({
      ok: true, value: { name: 'kiwi', species: 'tofu', color: 'matcha', tz: 'UTC' },
    })
  })
  it('keeps a valid tz and color', () => {
    const r = validateHatch({ name: 'k', species: 'mochi', color: 'sora', tz: 'America/Denver' })
    expect(r).toEqual({ ok: true, value: { name: 'k', species: 'mochi', color: 'sora', tz: 'America/Denver' } })
  })
  it.each([
    [{ species: 'mochi' }, 'name: 1-16 letters, digits, spaces, - or _'],
    [{ name: 'k', species: 'dragon' }, 'species must be mochi, tofu or onigiri'],
    [{ name: 'k', species: 'mochi', color: 'neon' }, 'unknown color'],
    [{ name: 'k', species: 'mochi', tz: 'Mars/Olympus' }, 'unknown time zone'],
    ['nope', 'body must be a JSON object'],
  ])('rejects %j', (body, error) => expect(validateHatch(body)).toEqual({ ok: false, error }))
})

describe('pruneEvents', () => {
  const ev = (t: number): Ev => ({ v: 1, type: 'heartbeat', at: t, t, session: 'aaaaaaaaaaaa' })
  it('drops events older than 24 h and keeps at most 50, newest last', () => {
    const now = 100 * 3_600_000
    const events = [ev(now - 25 * 3_600_000), ...Array.from({ length: 60 }, (_, i) => ev(now - 60 + i))]
    const out = pruneEvents(events, now)
    expect(out).toHaveLength(50)
    expect(out[49]!.t).toBe(now - 1)
    expect(out.every((e) => e.t > now - 24 * 3_600_000)).toBe(true)
  })
})

describe('allowRate', () => {
  it('allows `limit` per window, then refuses', () => {
    let stamps: number[] = []
    for (let i = 0; i < 3; i++) {
      const r = allowRate(stamps, 1000 + i, 3, 60_000)
      expect(r.ok).toBe(true)
      stamps = r.stamps
    }
    expect(allowRate(stamps, 1010, 3, 60_000).ok).toBe(false)
    expect(allowRate(stamps, 61_001, 3, 60_000).ok).toBe(true)
  })
})

describe('localDate', () => {
  it('uses the pet owner time zone', () => {
    const t = Date.UTC(2026, 9, 5, 3, 0) // 03:00 UTC on Oct 5 = Oct 4 in Denver
    expect(localDate(t, 'America/Denver')).toBe('2026-10-04')
    expect(localDate(t, 'UTC')).toBe('2026-10-05')
  })
})
```

- [ ] **Step 3: Run, see failure** — `npm install && npx vitest run apps/server` → FAIL.

- [ ] **Step 4: Implement `logic.ts`**

```ts
import {
  cleanName, DEFAULT_COLOR, EVENT_RETENTION_MS, isPetColor, isSpecies, MAX_MEMBER_EVENTS,
  type Ev, type PetColor, type Species,
} from '@burrow/core'

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export type Hatch = { name: string; species: Species; color: PetColor; tz: string }

function validTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function validateHatch(body: unknown): { ok: true; value: Hatch } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, error: 'body must be a JSON object' }
  const b = body as Record<string, unknown>
  const name = cleanName(b.name)
  if (!name) return { ok: false, error: 'name: 1-16 letters, digits, spaces, - or _' }
  if (!isSpecies(b.species)) return { ok: false, error: 'species must be mochi, tofu or onigiri' }
  const color = b.color === undefined ? DEFAULT_COLOR[b.species] : b.color
  if (!isPetColor(color)) return { ok: false, error: 'unknown color' }
  const tz = b.tz === undefined ? 'UTC' : b.tz
  if (typeof tz !== 'string' || !validTz(tz)) return { ok: false, error: 'unknown time zone' }
  return { ok: true, value: { name, species: b.species, color, tz } }
}

export function pruneEvents(events: Ev[], now: number): Ev[] {
  return events.filter((e) => e.t > now - EVENT_RETENTION_MS).slice(-MAX_MEMBER_EVENTS)
}

export function allowRate(stamps: number[], now: number, limit: number, windowMs: number): { ok: boolean; stamps: number[] } {
  const recent = stamps.filter((s) => s > now - windowMs)
  if (recent.length >= limit) return { ok: false, stamps: recent }
  return { ok: true, stamps: [...recent, now] }
}

export function localDate(t: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t)
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}
```

- [ ] **Step 5: Run** — `npx vitest run apps/server` → PASS.

- [ ] **Step 6: Implement the Durable Objects and router**

`apps/server/src/pet.ts`:
```ts
import { DurableObject } from 'cloudflare:workers'
import { parseWireEvent, type Ev, type MemberProfile } from '@burrow/core'
import { allowRate, localDate, sha256Hex, type Hatch } from './logic'

interface Profile extends MemberProfile {
  tz: string
  createdAt: number
}
interface Stats {
  mealsTotal: number
  mealsToday: number
  day: string
  lastEventAt: number | null
}
export type EventResult = { status: 204 } | { status: 400; error: string } | { status: 401 } | { status: 429 }

export class PetDO extends DurableObject<Env> {
  private stamps: number[] = []

  async hatch(petId: string, h: Hatch, secretHash: string, now: number): Promise<MemberProfile> {
    const profile: Profile = { petId, name: h.name, species: h.species, color: h.color, tz: h.tz, createdAt: now }
    await this.ctx.storage.put({
      profile,
      tokens: [secretHash],
      events: [] as Ev[],
      burrows: [] as string[],
      stats: { mealsTotal: 0, mealsToday: 0, day: localDate(now, h.tz), lastEventAt: null } satisfies Stats,
    })
    return { petId, name: profile.name, species: profile.species, color: profile.color }
  }

  async addBurrow(burrowId: string): Promise<void> {
    const burrows = (await this.ctx.storage.get<string[]>('burrows')) ?? []
    if (!burrows.includes(burrowId)) await this.ctx.storage.put('burrows', [...burrows, burrowId])
  }

  async event(secret: string, body: unknown, now: number): Promise<EventResult> {
    const tokens = (await this.ctx.storage.get<string[]>('tokens')) ?? []
    if (!tokens.includes(await sha256Hex(secret))) return { status: 401 }
    const rate = allowRate(this.stamps, now, 120, 60_000)
    this.stamps = rate.stamps
    if (!rate.ok) return { status: 429 }
    const parsed = parseWireEvent(body)
    if (!parsed.ok) return { status: 400, error: parsed.error }

    const ev: Ev = { ...parsed.value, t: now }
    const profile = (await this.ctx.storage.get<Profile>('profile'))!
    const stats = (await this.ctx.storage.get<Stats>('stats'))!
    const day = localDate(now, profile.tz)
    if (day !== stats.day) Object.assign(stats, { day, mealsToday: 0 })
    if (ev.type === 'stop') {
      stats.mealsTotal++
      stats.mealsToday++
    }
    stats.lastEventAt = now
    const events = (await this.ctx.storage.get<Ev[]>('events')) ?? []
    events.push(ev)
    await this.ctx.storage.put({ stats, events: events.filter((e) => e.t > now - 86_400_000).slice(-200) })

    const burrows = (await this.ctx.storage.get<string[]>('burrows')) ?? []
    await Promise.all(burrows.map((id) => this.env.BURROW.get(this.env.BURROW.idFromName(id)).ingest(profile.petId, ev)))
    return { status: 204 }
  }
}
```

`apps/server/src/burrow.ts`:
```ts
import { DurableObject } from 'cloudflare:workers'
import type { BurrowInfo, Ev, Member, MemberProfile, ServerMsg } from '@burrow/core'
import { pruneEvents } from './logic'

export class BurrowDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // Keepalive pings are answered without waking the object.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  async create(info: BurrowInfo): Promise<void> {
    await this.ctx.storage.put({ info, members: [] as Member[] })
  }

  async join(profile: MemberProfile, now: number): Promise<void> {
    const members = (await this.ctx.storage.get<Member[]>('members')) ?? []
    if (members.some((m) => m.petId === profile.petId)) return
    const member: Member = { ...profile, joinedAt: now, mealsTotal: 0, events: [] }
    await this.ctx.storage.put('members', [...members, member])
    this.broadcast({ t: 'member', member, serverNow: now })
  }

  async ingest(petId: string, ev: Ev): Promise<void> {
    const members = (await this.ctx.storage.get<Member[]>('members')) ?? []
    const m = members.find((x) => x.petId === petId)
    if (!m) return
    m.events = pruneEvents([...m.events, ev], ev.t)
    if (ev.type === 'stop') m.mealsTotal++
    await this.ctx.storage.put('members', members)
    this.broadcast({ t: 'event', petId, ev, serverNow: Date.now() })
  }

  override async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected a websocket', { status: 426 })
    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]
    this.ctx.acceptWebSocket(server)
    const info = await this.ctx.storage.get<BurrowInfo>('info')
    if (!info) {
      server.send(JSON.stringify({ t: 'error', code: 'not_found' } satisfies ServerMsg))
      server.close(4404, 'burrow not found')
    } else {
      const now = Date.now()
      const members = ((await this.ctx.storage.get<Member[]>('members')) ?? []).map((m) => ({ ...m, events: pruneEvents(m.events, now) }))
      server.send(JSON.stringify({ t: 'snapshot', burrow: info, members, serverNow: now } satisfies ServerMsg))
    }
    return new Response(null, { status: 101, webSocket: client })
  }

  override async webSocketMessage(): Promise<void> {
    // Milestone 1 clients send nothing but auto-answered pings.
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye')
    } catch {
      // already closed
    }
  }

  private broadcast(msg: ServerMsg): void {
    const s = JSON.stringify(msg)
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(s)
      } catch {
        // socket went away; the runtime cleans it up
      }
    }
  }
}
```

`apps/server/src/index.ts`:
```ts
import { isId, newId, parseToken, SECRET_LEN } from '@burrow/core'
import { json, sha256Hex, validateHatch } from './logic'

export { PetDO } from './pet'
export { BurrowDO } from './burrow'

const pet = (env: Env, id: string) => env.PET.get(env.PET.idFromName(id))
const burrow = (env: Env, id: string) => env.BURROW.get(env.BURROW.idFromName(id))

async function readJson(req: Request): Promise<unknown> {
  if (Number(req.headers.get('content-length') ?? 0) > 4096) return undefined
  try {
    return await req.json()
  } catch {
    return undefined
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const cors = {
      'access-control-allow-origin': env.WEB_ORIGIN,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    }
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const now = Date.now()

    if (req.method === 'POST' && url.pathname === '/v1/pets') {
      const hatch = validateHatch(await readJson(req))
      if (!hatch.ok) return json({ error: hatch.error }, 400, cors)
      const petId = newId()
      const secret = newId(SECRET_LEN)
      const burrowId = newId()
      const profile = await pet(env, petId).hatch(petId, hatch.value, await sha256Hex(secret), now)
      const b = burrow(env, burrowId)
      await b.create({ id: burrowId, name: `${profile.name}'s burrow`, env: 'garden', createdAt: now, createdBy: petId })
      await b.join(profile, now)
      await pet(env, petId).addBurrow(burrowId)
      return json({ petId, token: `${petId}.${secret}`, burrowId }, 201, cors)
    }

    if (req.method === 'POST' && url.pathname === '/v1/events') {
      const tok = parseToken(req.headers.get('authorization')?.replace(/^Bearer\s+/i, ''))
      if (!tok) return json({ error: 'bad token' }, 401)
      const r = await pet(env, tok.petId).event(tok.secret, await readJson(req), now)
      if (r.status === 204) return new Response(null, { status: 204 })
      if (r.status === 400) return json({ error: r.error }, 400)
      return json({ error: r.status === 401 ? 'bad token' : 'slow down' }, r.status)
    }

    const ws = url.pathname.match(/^\/v1\/burrows\/([^/]+)\/ws$/)
    if (req.method === 'GET' && ws) {
      if (!isId(ws[1])) return json({ error: 'not found' }, 404, cors)
      return burrow(env, ws[1]).fetch(req)
    }

    if (url.pathname === '/') return json({ name: 'burrow api', ok: true }, 200, cors)
    return json({ error: 'not found' }, 404, cors)
  },
} satisfies ExportedHandler<Env>
```

- [ ] **Step 7: Generate types, typecheck, and run locally**

Run: `npm run typecheck -w @burrow/server`
Expected: `worker-configuration.d.ts` generated (with `Env` containing `PET`, `BURROW`, `WEB_ORIGIN`), no type errors.

Run (background): `npm run dev:server`
Then:
```bash
curl -s -X POST http://127.0.0.1:8787/v1/pets -H 'content-type: application/json' -d '{"name":"kiwi","species":"mochi"}'
```
Expected: `201`-shaped JSON `{"petId":"…","token":"….…","burrowId":"…"}`.
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8787/v1/events -H "authorization: Bearer <token>" -H 'content-type: application/json' -d '{"v":1,"type":"stop","at":1791234567890,"session":"3f9a1c0e7b2d"}'
curl -s -X POST http://127.0.0.1:8787/v1/events -H "authorization: Bearer <token>" -H 'content-type: application/json' -d '{"v":1,"type":"stop","at":1,"session":"3f9a1c0e7b2d","cwd":"/x"}'
```
Expected: `204`, then `{"error":"unexpected keys: cwd"}`.

- [ ] **Step 8: Commit**

```bash
git add apps/server package-lock.json
git commit -m "server: Worker with PetDO and BurrowDO, strict event intake, live websocket"
```

---

### Task 7: CLI commands and build

**Files:**
- Create: `packages/cli/src/ui.ts`, `packages/cli/src/cli.ts`, `packages/cli/build.mjs`, `packages/cli/README.md`

**Interfaces:**
- Consumes: Task 4 config + hook, Task 5 settings, Task 6 HTTP API.
- Produces: `node packages/cli/dist/cli.mjs <init|status|privacy|uninstall>`; flags for init: `--name`, `--species`, `--api`, `--web`. Env: `BURROW_HOME`, `CLAUDE_SETTINGS`, `BURROW_API_URL`, `BURROW_WEB_URL`.

- [ ] **Step 1: `ui.ts` (copy and formatting)**

```ts
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
```

- [ ] **Step 2: `cli.ts`**

```ts
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
```

- [ ] **Step 3: `build.mjs`**

```js
import { build } from 'esbuild'

const common = { bundle: true, platform: 'node', format: 'esm', target: 'node20', logLevel: 'info' }
await build({ ...common, entryPoints: ['src/cli.ts'], outfile: 'dist/cli.mjs', banner: { js: '#!/usr/bin/env node' } })
await build({ ...common, entryPoints: ['src/hook-entry.ts'], outfile: 'dist/burrow-hook.mjs' })
```

`packages/cli/README.md`:
```md
# burrow-pets

A tiny pet that reacts live to Claude Code, in a garden shared with your friends.

    npx burrow-pets init

Each hook sends only `{ "v": 1, "type": "stop", "at": 1791234567890, "session": "3f9a1c0e7b2d" }`.
Never your prompts, code, file paths, repo names, or tool names. Run `npx burrow-pets privacy` to see the full list.
```

- [ ] **Step 4: Build and try it against the local server**

Run: `npm run build:cli && ls packages/cli/dist`
Expected: `burrow-hook.mjs  cli.mjs`.

With `npm run dev:server` running:
```bash
export BURROW_HOME=$(mktemp -d) CLAUDE_SETTINGS=$(mktemp -d)/settings.json
node packages/cli/dist/cli.mjs init --name kiwi --species mochi
node packages/cli/dist/cli.mjs privacy
cat "$CLAUDE_SETTINGS"
echo '{"session_id":"abc","cwd":"/secret"}' | node "$BURROW_HOME/burrow-hook.mjs" stop; echo "exit=$?"
node packages/cli/dist/cli.mjs uninstall && cat "$CLAUDE_SETTINGS"
```
Expected: init prints the hatched pet, the payload block, and a burrow URL; settings contain 7 burrow hooks, each `"async": true`; the hook prints nothing and `exit=0`; after uninstall, settings is `{}`.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck -w burrow-pets
git add packages/cli
git commit -m "cli: init, status, privacy, uninstall; esbuild bundle"
```

---

### Task 8: Web: garden, pet rig, live burrow page

**Files:**
- Create: `apps/web/{package.json,tsconfig.json,next.config.ts,postcss.config.mjs}`
- Create: `apps/web/app/{layout.tsx,globals.css,pet.css,page.tsx}`, `apps/web/app/b/[id]/page.tsx`
- Create: `apps/web/components/{Pet,Garden,BurrowView}.tsx`
- Create: `apps/web/lib/{sky,burrowState,useBurrow,usePetStates}.ts`
- Test: `apps/web/test/{burrowState,sky}.test.ts`

**Interfaces:**
- Consumes: `derive`, `PetState`, `Member`, `ServerMsg`, `BurrowInfo`, `spotsFor`, `GARDEN_VIEWBOX`, `PET_COLORS`, `Species`, `MAX_MEMBER_EVENTS`, `Ev` from core; WebSocket endpoint from Task 6.
- Produces:
```ts
// lib/sky.ts
export interface Sky { top: string; bottom: string; ink: string; night: boolean }
export function skyAt(hour: number): Sky
export function season(month: number): 'spring' | 'summer' | 'autumn' | 'winter'   // month 0-11
// lib/burrowState.ts
export type Status = 'connecting' | 'live' | 'reconnecting' | 'not_found'
export interface BurrowState { status: Status; burrow: BurrowInfo | null; members: Member[]; offset: number }
export const initialState: BurrowState
export type Action = { kind: 'msg'; msg: ServerMsg; clientNow: number } | { kind: 'status'; status: Status }
export function reduce(state: BurrowState, action: Action): BurrowState
// components/Pet.tsx
export function Pet(props: { species: Species; state: PetState; color: string; x?: number; y?: number; size?: number }): JSX.Element
```

- [ ] **Step 1: Package and config files**

`apps/web/package.json`:
```json
{
  "name": "@burrow/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@burrow/core": "*",
    "next": "^16.3.8",
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.3.3",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "tailwindcss": "^4.3.3"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2023"],
    "jsx": "preserve",
    "allowJs": false,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/next.config.ts`:
```ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@burrow/core'],
  reactStrictMode: true,
}
export default config
```

`apps/web/postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } }
```

- [ ] **Step 2: Failing tests for the pure web logic**

`apps/web/test/burrowState.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { BurrowInfo, Ev, Member } from '@burrow/core'
import { initialState, reduce } from '../lib/burrowState'

const burrow: BurrowInfo = { id: 'abcdefghjk', name: "kiwi's burrow", env: 'garden', createdAt: 1, createdBy: 'p1' }
const member = (petId: string): Member => ({ petId, name: petId, species: 'mochi', color: 'sakura', joinedAt: 1, mealsTotal: 0, events: [] })
const ev = (type: Ev['type'], t: number): Ev => ({ v: 1, type, at: t, session: 'aaaaaaaaaaaa', t })

describe('burrow reducer', () => {
  it('snapshot goes live and records the server clock offset', () => {
    const s = reduce(initialState, { kind: 'msg', clientNow: 1000, msg: { t: 'snapshot', burrow, members: [member('p1')], serverNow: 4000 } })
    expect(s).toMatchObject({ status: 'live', burrow, offset: 3000 })
    expect(s.members).toHaveLength(1)
  })
  it('appends events to the right member and counts meals', () => {
    let s = reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1'), member('p2')], serverNow: 0 } })
    s = reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'event', petId: 'p2', ev: ev('stop', 10), serverNow: 10 } })
    expect(s.members[1]!.events).toEqual([ev('stop', 10)])
    expect(s.members[1]!.mealsTotal).toBe(1)
    expect(s.members[0]!.events).toEqual([])
  })
  it('caps stored events per member', () => {
    let s = reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1')], serverNow: 0 } })
    for (let i = 0; i < 80; i++) s = reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'event', petId: 'p1', ev: ev('heartbeat', i), serverNow: i } })
    expect(s.members[0]!.events).toHaveLength(50)
  })
  it('adds new members once', () => {
    let s = reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1')], serverNow: 0 } })
    s = reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'member', member: member('p2'), serverNow: 0 } })
    s = reduce(s, { kind: 'msg', clientNow: 0, msg: { t: 'member', member: member('p2'), serverNow: 0 } })
    expect(s.members.map((m) => m.petId)).toEqual(['p1', 'p2'])
  })
  it('not_found sticks; reconnecting keeps the last members', () => {
    expect(reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'error', code: 'not_found' } }).status).toBe('not_found')
    const live = reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1')], serverNow: 0 } })
    const r = reduce(live, { kind: 'status', status: 'reconnecting' })
    expect(r.status).toBe('reconnecting')
    expect(r.members).toHaveLength(1)
  })
  it('ignores events for unknown pets', () => {
    const live = reduce(initialState, { kind: 'msg', clientNow: 0, msg: { t: 'snapshot', burrow, members: [member('p1')], serverNow: 0 } })
    expect(reduce(live, { kind: 'msg', clientNow: 0, msg: { t: 'event', petId: 'zz', ev: ev('stop', 1), serverNow: 1 } })).toEqual(live)
  })
})
```

`apps/web/test/sky.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { season, skyAt } from '../lib/sky'

describe('sky', () => {
  it('is night at 2am and 11pm, day at noon', () => {
    expect(skyAt(2).night).toBe(true)
    expect(skyAt(23).night).toBe(true)
    expect(skyAt(12).night).toBe(false)
  })
  it('returns hex colors for every quarter hour', () => {
    for (let h = 0; h < 24; h += 0.25) {
      const s = skyAt(h)
      expect(s.top).toMatch(/^#[0-9a-f]{6}$/)
      expect(s.bottom).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
  it('maps months to northern seasons', () => {
    expect(season(9)).toBe('autumn')
    expect(season(0)).toBe('winter')
    expect(season(3)).toBe('spring')
    expect(season(6)).toBe('summer')
  })
})
```

- [ ] **Step 3: Run, see failure** — `npm install && npx vitest run apps/web` → FAIL (modules missing).

- [ ] **Step 4: Implement `lib/sky.ts` and `lib/burrowState.ts`**

`apps/web/lib/sky.ts`:
```ts
export interface Sky {
  top: string
  bottom: string
  /** Text color that reads on this sky. */
  ink: string
  night: boolean
}

// hour, top, bottom
const KEYS: Array<[number, string, string]> = [
  [0, '#0d1530', '#24305a'],
  [4.5, '#1a2148', '#3b3f6e'],
  [6, '#4c5a93', '#e7a99a'],
  [8, '#8db9da', '#f2ddbf'],
  [12, '#78b0da', '#d6ecf3'],
  [16.5, '#7ea3d2', '#f1d6b0'],
  [18.5, '#5a5e9e', '#ee9c7e'],
  [20, '#232a5c', '#5b4d7a'],
  [21.5, '#111a3a', '#2b3462'],
  [24, '#0d1530', '#24305a'],
]

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a: string, b: string, t: number) => {
  const A = rgb(a), B = rgb(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i]! - v) * t).toString(16).padStart(2, '0')).join('')
}

export function skyAt(hour: number): Sky {
  const h = ((hour % 24) + 24) % 24
  let i = 0
  while (i < KEYS.length - 2 && h >= KEYS[i + 1]![0]) i++
  const [h0, t0, b0] = KEYS[i]!
  const [h1, t1, b1] = KEYS[i + 1]!
  const t = (h - h0) / (h1 - h0)
  const night = h < 5.5 || h >= 19.8
  return { top: mix(t0, t1, t), bottom: mix(b0, b1, t), ink: night ? '#eef0f8' : '#1e2433', night }
}

export function season(month: number): 'spring' | 'summer' | 'autumn' | 'winter' {
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'autumn'
  return 'winter'
}
```

`apps/web/lib/burrowState.ts`:
```ts
import { MAX_MEMBER_EVENTS, type BurrowInfo, type Member, type ServerMsg } from '@burrow/core'

export type Status = 'connecting' | 'live' | 'reconnecting' | 'not_found'

export interface BurrowState {
  status: Status
  burrow: BurrowInfo | null
  members: Member[]
  /** serverNow - clientNow at the last message: add to Date.now() to get server time. */
  offset: number
}

export const initialState: BurrowState = { status: 'connecting', burrow: null, members: [], offset: 0 }

export type Action = { kind: 'msg'; msg: ServerMsg; clientNow: number } | { kind: 'status'; status: Status }

export function reduce(state: BurrowState, action: Action): BurrowState {
  if (action.kind === 'status') return state.status === 'not_found' ? state : { ...state, status: action.status }
  const { msg, clientNow } = action
  switch (msg.t) {
    case 'snapshot':
      return { status: 'live', burrow: msg.burrow, members: msg.members, offset: msg.serverNow - clientNow }
    case 'member':
      if (state.members.some((m) => m.petId === msg.member.petId)) return state
      return { ...state, members: [...state.members, msg.member], offset: msg.serverNow - clientNow }
    case 'event': {
      if (!state.members.some((m) => m.petId === msg.petId)) return state
      const members = state.members.map((m) =>
        m.petId !== msg.petId
          ? m
          : { ...m, events: [...m.events, msg.ev].slice(-MAX_MEMBER_EVENTS), mealsTotal: m.mealsTotal + (msg.ev.type === 'stop' ? 1 : 0) },
      )
      return { ...state, members, offset: msg.serverNow - clientNow }
    }
    case 'error':
      return { ...initialState, status: 'not_found' }
  }
}
```

- [ ] **Step 5: Run** — `npx vitest run apps/web` → PASS.

- [ ] **Step 6: Live hooks**

`apps/web/lib/useBurrow.ts`:
```ts
'use client'
import { useEffect, useReducer } from 'react'
import type { ServerMsg } from '@burrow/core'
import { initialState, reduce } from './burrowState'

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '')

export function useBurrow(id: string) {
  const [state, dispatch] = useReducer(reduce, initialState)

  useEffect(() => {
    let ws: WebSocket | null = null
    let retry = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let ping: ReturnType<typeof setInterval> | undefined
    let stopped = false

    const connect = () => {
      ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/v1/burrows/${id}/ws`)
      ws.onopen = () => {
        retry = 0
        ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send('ping'), 25_000)
      }
      ws.onmessage = (e) => {
        if (e.data === 'pong') return
        try {
          dispatch({ kind: 'msg', msg: JSON.parse(e.data as string) as ServerMsg, clientNow: Date.now() })
        } catch {
          // ignore malformed frames
        }
      }
      ws.onclose = (e) => {
        clearInterval(ping)
        if (stopped || e.code === 4404) return
        dispatch({ kind: 'status', status: 'reconnecting' })
        timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++))
      }
    }
    connect()
    // A laptop waking from sleep: reconnect right away instead of waiting out the backoff.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && ws?.readyState === WebSocket.CLOSED) {
        clearTimeout(timer)
        retry = 0
        connect()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearTimeout(timer)
      clearInterval(ping)
      document.removeEventListener('visibilitychange', onVisible)
      ws?.close()
    }
  }, [id])

  return state
}
```

`apps/web/lib/usePetStates.ts`:
```ts
'use client'
import { useEffect, useMemo, useState } from 'react'
import { derive, type DeriveResult, type Member } from '@burrow/core'

/** Derives every member's state on the server's clock and re-renders exactly when one could change. */
export function usePetStates(members: Member[], offset: number): Map<string, DeriveResult> {
  const [tick, setTick] = useState(0)
  const results = useMemo(() => {
    const now = Date.now() + offset
    const stops = new Map(members.map((m) => [m.petId, m.events.filter((e) => e.type === 'stop').map((e) => e.t)]))
    return new Map(
      members.map((m) => {
        const friendStops = members.filter((o) => o.petId !== m.petId).flatMap((o) => stops.get(o.petId) ?? [])
        return [m.petId, derive({ events: m.events, friendStops, now })]
      }),
    )
    // tick forces a recompute when a timer fires
  }, [members, offset, tick])

  useEffect(() => {
    const next = Math.min(...[...results.values()].map((r) => r.nextChangeAt ?? Infinity))
    if (!Number.isFinite(next)) return
    const t = setTimeout(() => setTick((n) => n + 1), Math.max(16, next - (Date.now() + offset)))
    return () => clearTimeout(t)
  }, [results, offset])

  return results
}
```

- [ ] **Step 7: The pet rig (port of the directions board, matte look)**

`apps/web/app/pet.css`:
```css
.pet { overflow: visible; }
.pet .squash, .pet .hop, .pet .eyes, .pet .item, .pet .crumb, .pet .z, .pet .spark, .pet .bubble, .pet .hand, .pet .glow, .pet .mo, .pet .mc, .pet .shadow, .pet .arm { transform-box: fill-box; }
.pet .squash { transform-origin: 50% 100%; }
.pet .eyes, .pet .shadow { transform-origin: 50% 50%; }
.pet .arm { transform-origin: 50% 0; transform: rotate(var(--r)); }
.pet .z { font-family: var(--font-display); }

@media (prefers-reduced-motion: no-preference) {
  .st-idle .squash { animation: breathe 3.4s ease-in-out infinite; }
  .st-idle .eyes, .st-wave .eyes { animation: blink 4.6s infinite; }
  .st-eat .item { animation: drop 2.6s cubic-bezier(.5,0,.75,0) infinite; }
  .st-eat .squash { animation: chomp 2.6s ease-out infinite; }
  .st-eat .mo { animation: mouthOpen 2.6s steps(1) infinite; }
  .st-eat .mc { animation: mouthClosed 2.6s steps(1) infinite; }
  .st-eat .crumb { animation: crumb 2.6s ease-out infinite; }
  .st-eat .crumb.c2 { animation-name: crumb2; }
  .st-wave .arm-wave { animation: wave .42s ease-in-out infinite alternate; }
  .st-wave .squash { animation: lean 1.68s ease-in-out infinite; }
  .st-wave .bubble { animation: bob 1.2s ease-in-out infinite; }
  .st-work .hand { animation: type .26s ease-in-out infinite alternate; }
  .st-work .hand.h2 { animation-delay: -.13s; }
  .st-work .glow { animation: flicker 2.2s steps(4) infinite; }
  .st-work .squash { animation: breathe 2.4s ease-in-out infinite; }
  .st-sleep .squash { animation: snore 4.8s ease-in-out infinite; }
  .st-sleep .z { animation: zed 3.6s ease-out infinite; opacity: 0; }
  .st-sleep .z.z2 { animation-delay: 1.2s; }
  .st-sleep .z.z3 { animation-delay: 2.4s; }
  .st-cheer .hop { animation: hop 1s cubic-bezier(.3,.7,.4,1) infinite; }
  .st-cheer .squash { animation: land 1s ease-out infinite; }
  .st-cheer .shadow { animation: shadowHop 1s cubic-bezier(.3,.7,.4,1) infinite; }
  .st-cheer .arm-up { animation: wiggle .25s ease-in-out infinite alternate; }
  .st-cheer .spark { animation: spark 1s ease-out infinite; opacity: 0; }
  .st-cheer .spark.s2 { animation-delay: .33s; }
  .st-cheer .spark.s3 { animation-delay: .66s; }
}
@media (prefers-reduced-motion: reduce) {
  .st-eat .item, .st-eat .mo { opacity: 0; }
  .st-sleep .z { opacity: .8; }
}

@keyframes breathe { 0%,100% { transform: scale(1,1) } 50% { transform: scale(1.025,.965) } }
@keyframes snore { 0%,100% { transform: scale(1,1) } 50% { transform: scale(1.045,.94) } }
@keyframes blink { 0%,92%,100% { transform: scaleY(1) } 94% { transform: scaleY(.08) } 96% { transform: scaleY(1) } }
@keyframes drop { 0% { transform: translateY(-58px); opacity: 0 } 8% { opacity: 1 } 30% { transform: translateY(0); opacity: 1 } 33% { transform: translateY(2px) scale(.5); opacity: 0 } 100% { opacity: 0; transform: translateY(0) } }
@keyframes chomp { 0%,32% { transform: scale(1,1) } 38% { transform: scale(1.07,.9) } 46% { transform: scale(.98,1.03) } 54% { transform: scale(1.05,.94) } 62%,100% { transform: scale(1,1) } }
@keyframes mouthOpen { 0% { opacity: 0 } 12% { opacity: 1 } 33% { opacity: 0 } 100% { opacity: 0 } }
@keyframes mouthClosed { 0% { opacity: 1 } 12% { opacity: 0 } 33% { opacity: 1 } 100% { opacity: 1 } }
@keyframes crumb { 0%,34% { opacity: 0; transform: translate(0,0) } 40% { opacity: 1 } 64% { opacity: 0; transform: translate(-9px,6px) } 100% { opacity: 0 } }
@keyframes crumb2 { 0%,34% { opacity: 0; transform: translate(0,0) } 42% { opacity: 1 } 66% { opacity: 0; transform: translate(10px,4px) } 100% { opacity: 0 } }
@keyframes wave { from { transform: rotate(-162deg) } to { transform: rotate(-122deg) } }
@keyframes lean { 0%,100% { transform: rotate(0) } 50% { transform: rotate(-2.5deg) } }
@keyframes bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
@keyframes type { from { transform: translateY(0) } to { transform: translateY(-2.5px) } }
@keyframes flicker { 0% { opacity: .2 } 25% { opacity: .32 } 50% { opacity: .18 } 75% { opacity: .3 } 100% { opacity: .24 } }
@keyframes zed { 0% { transform: translate(0,0) scale(.7); opacity: 0 } 20% { opacity: .9 } 100% { transform: translate(10px,-26px) scale(1.15); opacity: 0 } }
@keyframes hop { 0%,12% { transform: translateY(0) } 38% { transform: translateY(-17px) } 62%,100% { transform: translateY(0) } }
@keyframes land { 0% { transform: scale(1.06,.92) } 12% { transform: scale(.95,1.06) } 38% { transform: scale(.98,1.03) } 62% { transform: scale(1.09,.88) } 74% { transform: scale(.98,1.03) } 86%,100% { transform: scale(1,1) } }
@keyframes shadowHop { 0%,12% { transform: scale(1) } 38% { transform: scale(.62); opacity: .5 } 62%,100% { transform: scale(1) } }
@keyframes wiggle { from { transform: rotate(calc(var(--r) - 8deg)) } to { transform: rotate(calc(var(--r) + 8deg)) } }
@keyframes spark { 0% { transform: scale(0) rotate(0); opacity: 0 } 20% { opacity: 1 } 55% { transform: scale(1) rotate(45deg); opacity: 1 } 100% { transform: scale(.2) rotate(90deg); opacity: 0 } }
```

`apps/web/components/Pet.tsx`:
```tsx
import type { CSSProperties, ReactNode } from 'react'
import type { PetState, Species } from '@burrow/core'

const BODY: Record<Species, { d: string; fy: number; armL: [number, number]; armR: [number, number]; nori?: true }> = {
  mochi: { d: 'M18 97 C14 66 36 40 60 40 C84 40 106 66 102 97 C101 101 19 101 18 97 Z', fy: 72, armL: [25, 84], armR: [95, 84] },
  tofu: { d: 'M31 46 H89 Q100 46 100 57 V91 Q100 100 91 100 H29 Q20 100 20 91 V57 Q20 46 31 46 Z', fy: 70, armL: [22, 82], armR: [98, 82] },
  onigiri: { d: 'M60 33 C67 33 72 38 77 47 L98 84 C104 95 98 100 87 100 L33 100 C22 100 16 95 22 84 L43 47 C48 38 53 33 60 33 Z', fy: 68, armL: [31, 86], armR: [89, 86], nori: true },
}
const INK = '#26241F'
const SPARK = 'M0 -7 Q1.2 -1.2 7 0 Q1.2 1.2 0 7 Q-1.2 1.2 -7 0 Q-1.2 -1.2 0 -7Z'

function star(cx: number, cy: number, r1: number, r2: number, n: number) {
  let p = ''
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = (Math.PI * i) / n - Math.PI / 2
    p += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
  }
  return p + 'Z'
}

function Arm({ at, r, cls, fill }: { at: [number, number]; r: number; cls: string; fill: string }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <g className={`arm ${cls}`} style={{ '--r': `${r}deg` } as CSSProperties}>
        <rect x={-5} y={-3} width={10} height={17} rx={5} fill={fill} />
      </g>
    </g>
  )
}

export interface PetProps {
  species: Species
  state: PetState
  color: string
  /** Placement when nested inside a parent SVG. */
  x?: number
  y?: number
  size?: number
}

export function Pet({ species, state, color, x, y, size = 120 }: PetProps) {
  const b = BODY[species]
  const fy = b.fy - (state === 'work' ? 7 : 0)
  const my = fy + 7
  const clipId = `clip-${species}`
  const dot = (cx: number) => <ellipse key={cx} cx={cx} cy={fy} rx={3.3} ry={state === 'wave' ? 4.2 : 3.6} fill={INK} />
  const arc = (d: string) => <path d={d} stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />

  let eyes: ReactNode = null
  if (state === 'idle' || state === 'wave') eyes = <g className="eyes">{dot(49)}{dot(71)}</g>
  if (state === 'work') eyes = <g className="eyes"><ellipse cx={49} cy={fy + 1.5} rx={3.2} ry={2.6} fill={INK} /><ellipse cx={71} cy={fy + 1.5} rx={3.2} ry={2.6} fill={INK} /></g>
  if (state === 'sleep') eyes = arc(`M44.5 ${fy} q4.5 3.6 9 0 M66.5 ${fy} q4.5 3.6 9 0`)
  if (state === 'eat' || state === 'cheer') eyes = arc(`M44.5 ${fy + 1.5} q4.5 -5.5 9 0 M66.5 ${fy + 1.5} q4.5 -5.5 9 0`)

  let mouth: ReactNode = null
  if (state === 'idle') mouth = arc(`M56 ${my} q4 3.2 8 0`)
  if (state === 'eat') mouth = <><ellipse className="mo" cx={60} cy={my + 1} rx={4.2} ry={4.6} fill={INK} /><path className="mc" d={`M55.5 ${my} q2.25 2.6 4.5 0 q2.25 2.6 4.5 0`} stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" /></>
  if (state === 'wave') mouth = <path d={`M55.5 ${my - 1} q4.5 7 9 0 z`} fill={INK} />
  if (state === 'sleep') mouth = <ellipse cx={60} cy={my + 1} rx={2} ry={2.3} fill={INK} opacity={0.85} />
  if (state === 'cheer') mouth = <><path d={`M53.5 ${my - 1.5} q6.5 11 13 0 z`} fill={INK} /><path d={`M56.5 ${my + 3.2} q3.5 2.6 7 0`} stroke="#FF8FA3" strokeWidth={2.4} fill="none" strokeLinecap="round" /></>

  const arms: Array<{ at: [number, number]; r: number; cls: string }> = []
  if (state === 'wave') arms.push({ at: b.armR, r: -140, cls: 'arm-wave' }, { at: b.armL, r: 22, cls: '' })
  if (state === 'cheer') arms.push({ at: b.armR, r: -150, cls: 'arm-up' }, { at: b.armL, r: 150, cls: 'arm-up' })

  return (
    <svg className={`pet st-${state}`} viewBox="0 0 120 120" x={x} y={y} width={size} height={size} aria-hidden="true">
      <defs>
        <clipPath id={clipId}><path d={b.d} /></clipPath>
        <radialGradient id="petLight" cx=".34" cy=".28" r=".55"><stop offset="0" stopColor="#fff" stopOpacity=".42" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <linearGradient id="petShade" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".16" /></linearGradient>
      </defs>
      <ellipse className="shadow" cx={60} cy={101.5} rx={34} ry={3.6} fill="rgba(35,30,20,.24)" />
      {state === 'eat' && (
        <>
          <g className="item"><path d={star(60, my + 1, 6.5, 4.2, 7)} fill="#F0C64E" stroke="#F0C64E" strokeWidth={2.2} strokeLinejoin="round" /></g>
          <circle className="crumb" cx={52} cy={my + 4} r={1.8} fill="#F0C64E" />
          <circle className="crumb c2" cx={68} cy={my + 4} r={1.6} fill="#F0C64E" />
        </>
      )}
      {state === 'wave' && (
        <g className="bubble">
          <path d="M86 6 h20 a8 8 0 0 1 8 8 v14 a8 8 0 0 1 -8 8 h-12 l-7 7 l1 -7 h-2 a8 8 0 0 1 -8 -8 v-14 a8 8 0 0 1 8 -8z" fill="rgba(255,255,255,.86)" stroke="rgba(255,255,255,.95)" strokeWidth={1.2} />
          <rect x={94} y={12} width={4.4} height={13} rx={2.2} fill={INK} />
          <circle cx={96.2} cy={30} r={2.5} fill={INK} />
        </g>
      )}
      {state === 'sleep' && (
        <>
          <text className="z" x={82} y={44} fontSize={17} fill={INK}>z</text>
          <text className="z z2" x={90} y={36} fontSize={13} fill={INK}>z</text>
          <text className="z z3" x={80} y={30} fontSize={20} fill={INK}>z</text>
        </>
      )}
      {state === 'cheer' && (
        <>
          <path className="spark" d={SPARK} transform="translate(18 38)" fill="#F0C64E" />
          <path className="spark s2" d={SPARK} transform="translate(104 30) scale(.8)" fill="#EFA9BC" />
          <path className="spark s3" d={SPARK} transform="translate(98 62) scale(.6)" fill="#98B062" />
        </>
      )}
      <g className="hop">
        <g className="squash">
          <path d={b.d} fill={color} />
          <g clipPath={`url(#${clipId})`}>
            {b.nori && <path d="M47 86 H73 V100 H47 Z" fill="#2F3A2B" />}
            <path d={b.d} fill="url(#petShade)" />
            <path d={b.d} fill="url(#petLight)" />
          </g>
          {arms.map((a) => <Arm key={a.cls + a.r} {...a} fill={color} />)}
          {state !== 'work' && (
            <>
              <ellipse cx={41} cy={fy + 6} rx={4.6} ry={2.6} fill="#E77C93" opacity={0.55} />
              <ellipse cx={79} cy={fy + 6} rx={4.6} ry={2.6} fill="#E77C93" opacity={0.55} />
            </>
          )}
          {eyes}
          {mouth}
        </g>
      </g>
      {state === 'work' && (
        <>
          <rect className="glow" x={38} y={fy - 10} width={44} height={20} rx={10} fill="#CDE7FF" opacity={0.28} />
          <rect x={34} y={72} width={52} height={29} rx={3.5} fill="#DCE0E6" />
          <circle cx={60} cy={86} r={4} fill="rgba(0,0,0,.18)" />
          <path d="M28 101 H92 L88 105 H32 Z" fill="#9AA1AC" />
          <ellipse className="hand" cx={45} cy={72} rx={5} ry={3.6} fill={color} />
          <ellipse className="hand h2" cx={75} cy={72} rx={5} ry={3.6} fill={color} />
        </>
      )}
    </svg>
  )
}
```

- [ ] **Step 8: The garden scene**

`apps/web/components/Garden.tsx`:
```tsx
import type { ReactNode } from 'react'
import { GARDEN_VIEWBOX } from '@burrow/core'
import type { Sky } from '@/lib/sky'

const W = GARDEN_VIEWBOX.w, H = GARDEN_VIEWBOX.h
const WALL_Y = 420 // top of the garden wall; gravel starts at 470
const POND = { cx: 800, cy: 700, rx: 250, ry: 82 }

// Seeded so the server and client render identical markup.
function rand(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

function Stars() {
  const r = rand(17)
  return <g>{Array.from({ length: 70 }, (_, i) => <circle key={i} cx={r() * W} cy={r() * (WALL_Y - 40)} r={(i % 3) + 1} fill="#fff" opacity={0.25 + (i % 4) * 0.15} />)}</g>
}

function Maple({ leaf }: { leaf: string }) {
  const r = rand(5)
  const blobs = Array.from({ length: 16 }, () => ({ x: 1180 + r() * 300, y: 230 + r() * 170, rad: 42 + r() * 40 }))
  return (
    <g>
      <path d="M1330 470 C1326 420 1318 380 1290 340 M1328 420 C1350 380 1380 360 1410 330" stroke="#5A4434" strokeWidth={16} fill="none" strokeLinecap="round" />
      {blobs.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.rad} fill={leaf} opacity={0.82 + (i % 3) * 0.06} />)}
    </g>
  )
}

function Lantern({ lit }: { lit: boolean }) {
  // Stone toro lantern, drawn simply: base, pillar, light box, roof, finial.
  return (
    <g transform="translate(1480 640)">
      {lit && <circle cx={0} cy={-92} r={90} fill="url(#lanternGlow)" />}
      <rect x={-34} y={-16} width={68} height={16} rx={4} fill="#8C8982" />
      <rect x={-13} y={-74} width={26} height={60} rx={4} fill="#9C998F" />
      <rect x={-30} y={-80} width={60} height={10} rx={3} fill="#8C8982" />
      <rect x={-22} y={-114} width={44} height={36} rx={3} fill="#9C998F" />
      <rect x={-11} y={-106} width={22} height={20} rx={2} fill={lit ? '#FFD58A' : '#6E6B64'} />
      <path d="M-48 -112 Q0 -142 48 -112 L38 -108 Q0 -128 -38 -108 Z" fill="#7D7A73" />
      <circle cx={0} cy={-136} r={7} fill="#7D7A73" />
    </g>
  )
}

export function Garden({ sky, leaf, children }: { sky: Sky; leaf: string; children?: ReactNode }) {
  const gravel = sky.night ? '#2B2E35' : '#E6E4DA'
  const rake = sky.night ? '#353943' : '#D3CFC2'
  const wall = sky.night ? '#3B3E46' : '#EDE8DC'
  const roof = sky.night ? '#23252B' : '#4A4E57'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky.top} /><stop offset="1" stopColor={sky.bottom} /></linearGradient>
        <linearGradient id="pond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky.bottom} /><stop offset="1" stopColor={sky.top} /></linearGradient>
        <radialGradient id="lanternGlow"><stop offset="0" stopColor="#FFD58A" stopOpacity=".55" /><stop offset="1" stopColor="#FFD58A" stopOpacity="0" /></radialGradient>
        <radialGradient id="sunGlow"><stop offset=".35" stopColor="#FFE9A8" stopOpacity=".35" /><stop offset="1" stopColor="#FFE9A8" stopOpacity="0" /></radialGradient>
      </defs>

      <rect width={W} height={WALL_Y + 20} fill="url(#sky)" />
      {sky.night ? (
        <>
          <Stars />
          <circle cx={360} cy={150} r={34} fill="#F3EFD8" />
          <circle cx={373} cy={142} r={30} fill={sky.top} opacity={0.9} />
        </>
      ) : (
        <>
          <circle cx={420} cy={170} r={110} fill="url(#sunGlow)" />
          <circle cx={420} cy={170} r={46} fill="#FFE9A8" />
          <rect x={720} y={120} width={220} height={52} rx={26} fill="#fff" opacity={0.55} />
          <rect x={1040} y={210} width={150} height={36} rx={18} fill="#fff" opacity={0.5} />
        </>
      )}

      {/* misty far hills */}
      <path d={`M0 ${WALL_Y} C 200 330 380 350 560 380 S 900 320 1120 360 S 1450 330 1600 370 V${WALL_Y + 20} H0Z`} fill={sky.night ? '#1C2340' : '#B9C9CF'} opacity={0.6} />

      <Maple leaf={leaf} />

      {/* garden wall with a tiled cap */}
      <rect x={0} y={WALL_Y} width={W} height={60} fill={wall} />
      {[0, 1, 2].map((i) => <rect key={i} x={0} y={WALL_Y + 18 + i * 12} width={W} height={2.5} fill={sky.night ? '#4A4D56' : '#FFFFFF'} opacity={0.7} />)}
      <rect x={-10} y={WALL_Y - 14} width={W + 20} height={18} rx={9} fill={roof} />

      {/* gravel and rake lines */}
      <rect x={0} y={WALL_Y + 50} width={W} height={H} fill={gravel} />
      {Array.from({ length: 22 }, (_, i) => {
        const y = WALL_Y + 70 + i * 22
        return <path key={i} d={`M0 ${y} Q ${W / 4} ${y - 5} ${W / 2} ${y} T ${W} ${y}`} stroke={rake} strokeWidth={2.2} fill="none" />
      })}

      {/* pond with rake rings */}
      {[3, 2, 1].map((k) => <ellipse key={k} cx={POND.cx} cy={POND.cy} rx={POND.rx + k * 26} ry={POND.ry + k * 12} fill={gravel} stroke={rake} strokeWidth={2.2} />)}
      <ellipse cx={POND.cx} cy={POND.cy} rx={POND.rx + 10} ry={POND.ry + 8} fill="#9A978F" />
      <ellipse cx={POND.cx} cy={POND.cy} rx={POND.rx} ry={POND.ry} fill="url(#pond)" />
      <ellipse cx={POND.cx - 90} cy={POND.cy - 18} rx={70} ry={6} fill="#fff" opacity={0.18} />
      <ellipse cx={POND.cx + 120} cy={POND.cy + 22} rx={26} ry={9} fill="#7E9C55" />

      {/* moss islands */}
      <ellipse cx={120} cy={640} rx={90} ry={26} fill="#8EA35C" opacity={sky.night ? 0.5 : 0.9} />
      <ellipse cx={1600 - 300} cy={960} rx={120} ry={30} fill="#8EA35C" opacity={sky.night ? 0.5 : 0.9} />

      <Lantern lit={sky.night} />
      {children}
    </svg>
  )
}

/** A stepping stone with rake rings, drawn under a pet. */
export function Stone({ x, y, scale, night }: { x: number; y: number; scale: number; night: boolean }) {
  const rx = 82 * scale, ry = 24 * scale
  const rake = night ? '#353943' : '#D3CFC2'
  const gravel = night ? '#2B2E35' : '#E6E4DA'
  return (
    <g>
      {[2, 1].map((k) => <ellipse key={k} cx={x} cy={y} rx={rx + k * 22} ry={ry + k * 10} fill={gravel} stroke={rake} strokeWidth={2.2} />)}
      <ellipse cx={x} cy={y + 4} rx={rx} ry={ry} fill="#85827B" />
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#A3A099" />
      <ellipse cx={x - rx * 0.3} cy={y - ry * 0.35} rx={rx * 0.35} ry={ry * 0.25} fill="#fff" opacity={0.18} />
    </g>
  )
}
```

- [ ] **Step 9: The live burrow view and routes**

`apps/web/components/BurrowView.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import { GARDEN_VIEWBOX, PET_COLORS, spotsFor, TIMING, type Member, type PetState } from '@burrow/core'
import { Garden, Stone } from './Garden'
import { Pet } from './Pet'
import { season, skyAt } from '@/lib/sky'
import { useBurrow } from '@/lib/useBurrow'
import { usePetStates } from '@/lib/usePetStates'

const LEAF = { spring: '#E9B7C4', summer: '#7FA05A', autumn: '#C9573B', winter: '#A7AE9F' } as const
const VERB: Record<PetState, string> = {
  idle: 'hanging out', eat: 'eating', wave: 'needs you', work: 'working', sleep: 'asleep', cheer: 'cheering',
}
const WHY: Record<PetState, string> = {
  idle: 'agent is quiet', eat: 'agent finished a task', wave: 'agent is waiting for input',
  work: 'agent is on a long run', sleep: `no activity for ${TIMING.idleMs / 60_000} minutes`, cheer: 'a friend just shipped',
}

function ago(ms: number): string {
  const m = Math.round(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  return `${Math.round(m / 60)} h ago`
}

function useClockHour(): number {
  const [hour, setHour] = useState(() => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 })
  useEffect(() => {
    const t = setInterval(() => { const d = new Date(); setHour(d.getHours() + d.getMinutes() / 60) }, 60_000)
    return () => clearInterval(t)
  }, [])
  return hour
}

export function BurrowView({ id }: { id: string }) {
  const { status, burrow, members, offset } = useBurrow(id)
  const states = usePetStates(members, offset)
  const hour = useClockHour()
  const sky = skyAt(hour)
  const leaf = LEAF[season(new Date().getMonth())]
  const spots = spotsFor(members.length)
  const placed = members.slice(0, spots.length).map((m, i) => ({ m, spot: spots[i]! }))

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden" style={{ background: sky.top }}>
      <Garden sky={sky} leaf={leaf}>
        {[...placed].sort((a, b) => a.spot.y - b.spot.y).map(({ m, spot }) => {
          const size = 200 * spot.scale
          const st = states.get(m.petId)?.state ?? 'sleep'
          return (
            <g key={m.petId}>
              <Stone x={spot.x} y={spot.y} scale={spot.scale} night={sky.night} />
              <Pet species={m.species} state={st} color={PET_COLORS[m.color]} x={spot.x - size / 2} y={spot.y - size + 14 * spot.scale} size={size} />
            </g>
          )
        })}
      </Garden>

      <header className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-5 py-4 sm:px-8" style={{ color: sky.ink }}>
        <span className="font-display text-xl font-bold">burrow</span>
        {burrow && <span className="truncate text-sm opacity-80">{burrow.name}</span>}
        <span className="glass ml-auto rounded-full px-3 py-1 text-xs font-medium" role="status">
          {status === 'live' ? 'live' : status === 'not_found' ? 'not found' : status === 'reconnecting' ? 'reconnecting…' : 'connecting…'}
        </span>
      </header>

      <Tags placed={placed} states={states} />

      {status === 'not_found' && (
        <Notice title="this burrow doesn't exist." body="check the link, or start your own with npx burrow-pets init" />
      )}
      {status === 'live' && members.length === 0 && (
        <Notice title="nobody lives here yet." body="run npx burrow-pets init to hatch the first pet." />
      )}

      <ul className="sr-only" aria-live="polite">
        {members.map((m) => {
          const r = states.get(m.petId)
          const st = r?.state ?? 'sleep'
          return (
            <li key={m.petId}>
              {m.name} is {VERB[st]}: {WHY[st]}{r?.lastEventAt ? `, last activity ${ago(Date.now() + offset - r.lastEventAt)}` : ''}.
            </li>
          )
        })}
      </ul>
    </main>
  )
}

function Tags({ placed, states }: { placed: Array<{ m: Member; spot: { x: number; y: number; scale: number } }>; states: ReturnType<typeof usePetStates> }) {
  // Tags are HTML so they stay crisp and selectable; positioned in % of the same viewBox the SVG slices.
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2 aspect-[16/10] min-h-full min-w-full -translate-x-1/2 -translate-y-1/2">
        {placed.map(({ m, spot }) => {
          const st = states.get(m.petId)?.state ?? 'sleep'
          return (
            <span
              key={m.petId}
              className={`tag absolute -translate-x-1/2 ${st === 'wave' ? 'tag-alert' : ''}`}
              style={{ left: `${(spot.x / GARDEN_VIEWBOX.w) * 100}%`, top: `${((spot.y + 34 * spot.scale) / GARDEN_VIEWBOX.h) * 100}%` }}
            >
              {m.name}
              <i>{VERB[st]}</i>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="absolute inset-x-4 bottom-8 z-10 mx-auto max-w-md rounded-2xl p-5 text-center glass">
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="mt-1 text-sm opacity-80">{body}</p>
    </div>
  )
}
```

`apps/web/app/globals.css`:
```css
@import "tailwindcss";

@theme {
  --font-display: var(--font-zen-maru), ui-rounded, system-ui, sans-serif;
  --font-sans: var(--font-zen-kaku), system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
}

:root {
  --washi: #e9ece4;
  --sumi: #26241f;
  --glass: rgba(255, 255, 255, 0.4);
  --glass-line: rgba(255, 255, 255, 0.6);
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --washi: #14161a; --sumi: #edebe4; --glass: rgba(30, 32, 38, 0.45); --glass-line: rgba(255, 255, 255, 0.16); color-scheme: dark; }
}
:root[data-theme="dark"] { --washi: #14161a; --sumi: #edebe4; --glass: rgba(30, 32, 38, 0.45); --glass-line: rgba(255, 255, 255, 0.16); color-scheme: dark; }

body { background: var(--washi); color: var(--sumi); font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
:focus-visible { outline: 2px solid #4e6ea3; outline-offset: 3px; border-radius: 8px; }

.glass {
  background: var(--glass);
  border: 1px solid var(--glass-line);
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 10px 30px rgba(20, 24, 40, 0.12);
}
@media (prefers-reduced-transparency: reduce) { .glass { backdrop-filter: none; -webkit-backdrop-filter: none; background: var(--washi); } }

.tag {
  font: 700 clamp(10px, 0.95vw, 14px) / 1 var(--font-display);
  padding: 0.45em 0.85em;
  border-radius: 999px;
  color: #f4f2ec;
  white-space: nowrap;
  background: rgba(28, 26, 22, 0.46);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.tag i { font-style: normal; font-weight: 500; opacity: 0.78; margin-left: 0.45em; }
.tag-alert { background: rgba(38, 36, 31, 0.86); box-shadow: 0 0 0 3px rgba(240, 198, 78, 0.55); }
```

`apps/web/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Geist_Mono, Zen_Kaku_Gothic_New, Zen_Maru_Gothic } from 'next/font/google'
import './globals.css'
import './pet.css'

const display = Zen_Maru_Gothic({ weight: ['500', '700'], subsets: ['latin'], variable: '--font-zen-maru' })
const body = Zen_Kaku_Gothic_New({ weight: ['400', '500', '700'], subsets: ['latin'], variable: '--font-zen-kaku' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'burrow',
  description: 'a tiny pet that reacts live to your coding agent, in a garden shared with your friends.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

`apps/web/app/page.tsx` (placeholder until milestone 4):
```tsx
export default function Home() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col justify-center gap-5 px-6">
      <h1 className="font-display text-5xl font-bold tracking-tight">everyone&apos;s agents, one burrow.</h1>
      <p className="text-lg opacity-80">A tiny pet that reacts live to Claude Code, in a garden shared with your friends.</p>
      <code className="glass w-fit rounded-full px-5 py-3 font-mono text-sm">npx burrow-pets init</code>
    </main>
  )
}
```

`apps/web/app/b/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { isId } from '@burrow/core'
import { BurrowView } from '@/components/BurrowView'

export default async function BurrowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isId(id)) notFound()
  return <BurrowView id={id} />
}
```

- [ ] **Step 10: Typecheck, run, look**

Run: `npm run typecheck -w @burrow/web && npx vitest run`
Expected: no type errors; all tests PASS.

With `npm run dev:server` and `npm run dev:web` running, hatch a pet (Task 7 Step 4 commands), open `http://localhost:3000/b/<burrowId>` at 1440×900 and 390×844, and fire `stop`, `notify` (with `{"notification_type":"permission_prompt"}`), and `prompt` through the hook script. Expected: the pet eats for 6 s then idles; waves with a gold-ringed tag; after 15 s of `prompt` it works on the laptop. Check light and dark (system theme) and reduced motion (DevTools rendering emulation). Fix what the screenshots show in one batch, confirm once.

- [ ] **Step 11: Commit**

```bash
git add apps/web package-lock.json
git commit -m "web: zen garden burrow page with live pets"
```

---

### Task 9: End-to-end smoke test and milestone demo

**Files:**
- Create: `scripts/smoke.mjs`; Modify: `README.md`

**Interfaces:**
- Consumes: built CLI (`packages/cli/dist`), running server on `127.0.0.1:8787`.

- [ ] **Step 1: Write the smoke script**

`scripts/smoke.mjs`:
```js
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
```

- [ ] **Step 2: Run it**

Run: `npm run build:cli && npm run smoke` (with `npm run dev:server` running)
Expected: `smoke ok: snapshot + prompt -> needs_input -> stop; no private data on the wire`

- [ ] **Step 3: README quickstart**

Replace `README.md` with:
```md
# burrow

A tiny pet that reacts live to your coding agent, in a garden shared with your friends.

Your pet eats when Claude Code finishes a task, waves when it needs your input, works on a tiny laptop during long runs, and sleeps when you're away. Friends' pets live in the same garden, so you can see who's shipping, who's stuck, and who fell asleep.

## Privacy

Each hook sends only `{ "v": 1, "type": "stop", "at": 1791234567890, "session": "3f9a1c0e7b2d" }`. Never your prompts, code, file paths, repo names, or tool names. The server rejects anything else.

## Develop

    npm install
    npm run dev:server        # Cloudflare Worker on :8787
    npm run dev:web           # Next.js on :3000
    npm run build:cli
    node packages/cli/dist/cli.mjs init
    npm test                  # unit tests
    npm run smoke             # end-to-end against the local server

Monorepo: `packages/core` (state machine, schema), `packages/cli` (`burrow-pets`), `apps/server` (Workers + Durable Objects), `apps/web` (Next.js). Design: `docs/superpowers/specs/2026-10-04-burrow-design.md`.

MIT licensed.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke.mjs README.md
git commit -m "smoke test: CLI to hook to websocket, privacy asserted end to end"
```

- [ ] **Step 5: Milestone demo**

Not in milestone 1 (tracked for milestone 2): per-IP rate limit on `POST /v1/pets`, `join`, `link`, browser claim, presence.


Capture screenshots of the burrow page in each live state (idle, eat, wave, work) at desktop and mobile, light and dark, and show them to the user with the smoke output. Deployment (wrangler login, Vercel) waits for the user's go-ahead and domain choice.
