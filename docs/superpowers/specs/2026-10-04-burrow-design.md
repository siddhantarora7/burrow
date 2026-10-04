# burrow: design spec

Date: 2026-10-04 · Status: approved in conversation, pending written review

burrow gives each developer a small pet that reacts live to their AI coding agent (Claude Code first). Friends' pets live together in a shared burrow, a web page kept open on a second screen. Product truth lives in `PRODUCT.md`; this doc owns the decisions.

## 1. Decisions at a glance

| Area | Decision | Why |
|---|---|---|
| Name | burrow; npm package `burrow-pets` (`burrow` is squatted) | Domain TBD: burrow.party or getburrow.dev |
| Visual world | B's pets, type, and glass discipline, set in **environments**. Main env: **zen garden** (see §9). No underground/soil scenes | The user rejected the literal dirt burrow; "burrow" names the crew's shared space, not a hole |
| Environments | Data-driven scenes: background layers + pet spots + day/night lighting. Launch: zen garden (default), tatami room (milestone 2) | One rig, many places; owner picks per burrow |
| Species | mochi, tofu, onigiri | All three ship at launch |
| Realtime + storage | Cloudflare Workers + Durable Objects | Never pauses (Supabase free tier pauses after 7 idle days, fatal for a portfolio link); hibernating WebSockets make idle tabs ~free; one object per burrow matches the product |
| Web | Next.js (App Router) on Vercel | Static landing, client burrow page, `next/og` share cards |
| Identity | No account. CLI hatches a pet with a device token | Lowest friction for a launch post |
| GitHub login | Deferred past launch | Only adds cross-machine claim; `npx burrow-pets link` covers it |
| Hook transport | Local `command` hook script, `async: true` | Claude Code's `http` hook type would POST the full hook JSON (prompt, cwd, transcript path, tool input). Never use it |
| State machine | One pure function shared by browser, server, and OG renderer | Deterministic, unit-testable, no server timers |
| Pet animation | SVG + CSS keyframes (transform/opacity only) | Proven on the directions board; no Motion, no Rive |
| TypeScript | `typescript` 6.0.x (not 7.x) | 7.x is the native Go port; Next.js and vitest tooling expect the 6.x JS API |

### Dependencies (approved)

Runtime: `next`, `react`, `react-dom`, `tailwindcss` v4 (+ `@tailwindcss/postcss`).
Tooling: `typescript`, `vitest`, `wrangler`, `@cloudflare/workers-types`.
Conditional: `gsap` only if milestone 4's pinned story sections cannot be done with CSS scroll-driven animations; ask first.
Explicitly not used: framer-motion/motion, lenis, zod, any auth library, any UI kit. The CLI has zero runtime dependencies.

## 2. Repository layout

npm workspaces (Node ≥ 20; developed on Node 24).

```
burrow/
  packages/core/     event schema, derive() state machine, burrow layout, growth stages. Pure TS, no deps.
  packages/cli/      published as `burrow-pets`. init / join / link / status / privacy / uninstall.
  apps/server/       Cloudflare Worker: HTTP API, PetDO, BurrowDO.
  apps/web/          Next.js: landing (/), burrow (/b/[id]), pet card (/p/[id]), claim (/claim).
  design/directions/ the direction board (history; not shipped).
  docs/              this spec, plans, architecture notes.
```

`core` is consumed as TypeScript source by the other workspaces (no build step during development); the CLI bundles what it needs at publish time.

## 3. Privacy contract

The hook sends exactly this, nothing more:

```http
POST /v1/events
Authorization: Bearer <petId>.<secret>
Content-Type: application/json

{ "v": 1, "type": "stop", "at": 1791234567890, "session": "3f9a1c0e7b2d" }
```

- `type` ∈ `session_start | prompt | heartbeat | needs_input | stop | error | session_end`.
- `at` is the client's epoch ms, used only for ordering within a session. The server stamps its own receive time `t` and derives state from `t`.
- `session` = first 12 hex chars of `sha256(localSalt + claudeSessionId)`. `localSalt` is random, generated at `init`, and never leaves `~/.burrow/`. The raw Claude session id is never sent.
- Never sent: prompts, messages, code, file paths, cwd, repo names, tool names, tool input/output, transcript paths, model, IP-derived data beyond what HTTP inherently carries.
- The server rejects any body with extra keys (strict validation), so a future bug cannot quietly widen the payload.
- The CLI prints this exact JSON block during `init` and on `npx burrow-pets privacy`. The landing page shows it in the privacy section, in plain words.

## 4. CLI (`burrow-pets`)

Zero runtime deps: `node:util` parseArgs, global `fetch`, `node:crypto`, `node:fs`.

| Command | Does |
|---|---|
| `init [invite-link]` | Asks pet name + species (+ color from a fixed palette). `POST /v1/pets`. Writes `~/.burrow/config.json` (petId, token, salt, apiUrl, mode 0600). Copies the hook script to `~/.burrow/hook.mjs`. Merges hooks into `~/.claude/settings.json`. Creates your own burrow, or joins the invite. Prints the privacy payload, the burrow link, and a one-time browser sign-in link. |
| `join <link>` | Joins another burrow (a pet can live in several). |
| `link` | Prints a short-lived code to use this pet on another machine (`init --code XXXX`). |
| `status` | Pet, burrows, hooks installed or not, last event sent. |
| `privacy` | Prints exactly what is sent and the hook → event table. |
| `uninstall` | Removes burrow's hooks from settings (only entries whose command contains `.burrow/hook.mjs`) and deletes `~/.burrow/`. |

### Settings merge rules

- Read `~/.claude/settings.json` (create if missing). Back it up to `~/.burrow/settings.backup.<timestamp>.json` before writing.
- For each event below, append one matcher group if no existing hook command contains `.burrow/hook.mjs`. Idempotent; never touches other hooks.
- Write atomically (temp file + rename), preserving 2-space JSON formatting.
- If the file is not valid JSON, abort with a clear message and change nothing.

### Hooks installed

All entries: `{"type":"command","command":"node \"$HOME/.burrow/hook.mjs\" <event>","async":true,"timeout":5}`.

| Claude Code event | Matcher | burrow event |
|---|---|---|
| `SessionStart` | (all) | `session_start` |
| `UserPromptSubmit` | (all) | `prompt` |
| `PostToolBatch` | (all) | `heartbeat` (throttled to ≤ 1/min/session via `~/.burrow/hb/<session>` mtime) |
| `Notification` | (all; script filters) | `needs_input` when `notification_type` ∈ `permission_prompt, agent_needs_input, elicitation_dialog`; otherwise nothing is sent |
| `Stop` | (all) | `stop` |
| `StopFailure` | (all) | `error` |
| `SessionEnd` | (all) | `session_end` |

Hook script rules: read stdin JSON, keep only `session_id` and `notification_type`, discard the rest immediately; 3 s fetch timeout; always exit 0; never print to stdout (async output is ignored anyway). Implementation verified against the current hooks reference (code.claude.com/docs/en/hooks, fetched 2026-10-04).

## 5. Server (Cloudflare)

### Objects

**PetDO** (one per pet, id = petId)
- `profile`: name, species, color, createdAt, secretHash (sha256).
- `events`: ring buffer of the last 200 events, pruned to 24 h.
- `stats`: mealsTotal, mealsToday + its date (in the pet's IANA timezone, sent at init), lastEventAt.
- `burrows`: ids this pet belongs to.
- On a valid event: append, update stats, forward `{petId, ev}` to each BurrowDO.

**BurrowDO** (one per burrow, id = burrowId)
- `meta`: name, createdAt, createdBy, env (`garden` default).
- `members`: petId → {name, species, color, stage, joinedAt}, plus a cached copy of each member's recent events (so a snapshot needs no fan-in).
- WebSockets via the hibernation API. Each socket's attachment: `{ viewerPetId | null }`.
- Presence = set of viewerPetIds with at least one open socket ("who has the burrow open").

No global database. Tokens are `petId.secret`, so the Worker routes straight to `PetDO(petId)`, which verifies the secret hash.

### HTTP API (`api.<domain>`)

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /v1/pets` | none (rate-limited per IP) | Hatch: `{name, species, color, tz}` → `{petId, token, burrowId, claimCode}` |
| `POST /v1/events` | pet token | The hook payload (§3) |
| `POST /v1/burrows` | pet token | Create a burrow → `{burrowId}` |
| `POST /v1/burrows/:id/join` | pet token | Join |
| `POST /v1/claim` | none | Exchange a one-time claim code (10 min TTL) for the pet token, stored in the browser |
| `POST /v1/link` | pet token | Issue a short code for another machine |
| `GET /v1/burrows/:id/ws` | optional token in first message | Live burrow stream |
| `GET /v1/pets/:id/card` | none | Public snapshot for share cards (name, species, color, stage, mealsToday, state) |

Burrow ids and pet ids: 10-char Crockford base32, random. A burrow link is both the view link and the invite (link-sharing model). Joining requires a pet.

### WebSocket protocol (JSON)

Server → client: `snapshot {burrow, members[], presence[], serverNow}`, `event {petId, ev}`, `member {pet}`, `presence {petIds[]}`, `social {kind: "treat"|"cheer", from, to, t}`.
Client → server: `hello {token?}`, `social {kind, to}`.

### Limits

Events: 120/min per pet (excess dropped with 429). Social: 1 per 10 s per sender. Members: 24 per burrow at launch.

## 6. State machine (`packages/core`)

```ts
type PetState = 'idle' | 'eat' | 'wave' | 'work' | 'sleep' | 'cheer'
derive(input: { events: Ev[]; friendStops: number[]; now: number }): { state: PetState; since: number; nextChangeAt: number | null }
```

Events are grouped by `session`. Per session, the latest event decides its phase: `prompt`/`heartbeat`/`session_start` → running; `needs_input`/`error` → waiting; `stop` → done; `session_end` → ended. A running session with no event for 10 min is stale (treated as ended).

Pet state, first match wins:

| # | State | Rule |
|---|---|---|
| 1 | wave | any session waiting |
| 2 | eat | a `stop` within the last 6 s |
| 3 | cheer | a friend's `stop` within the last 3 s, and the pet would otherwise be `work` or `idle` (sleeping pets stay asleep) |
| 4 | work | any session running for ≥ 15 s (debounce: short turns never flash the laptop) |
| 5 | idle | any event within the last 20 min |
| 6 | sleep | otherwise |

`nextChangeAt` is the earliest future instant at which the result could change without a new event (eat expiring, work debounce maturing, stale cutoff, idle → sleep). Callers schedule one timer for it. Constants live in one exported `TIMING` object.

Tests (vitest, fake clock): one table-driven test per rule, priority conflicts, parallel sessions, stale sessions, out-of-order `at`, the exact `nextChangeAt` for each transition, and a property test that `derive` is stable between `now` and `nextChangeAt`.

Growth: `stageFor(mealsTotal)`: hatchling 0–9, sprout 10–49, grown 50+. Visuals are designed in milestone 3.

## 7. Web (`apps/web`)

| Route | Render | Content |
|---|---|---|
| `/` | static | Landing (milestone 4) |
| `/b/[id]` | client | The burrow in its environment: time-of-day sky, one spot per member, live states, presence, treats/cheers |
| `/p/[id]` | static shell + `next/og` image | Pet card for sharing |
| `/claim` | client | Reads `#code`, exchanges it, stores the token in localStorage, redirects to the burrow |

Scene layout: each environment declares an ordered list of spots (normalized x/y + scale) for desktop and for mobile; `spotsFor(env, memberCount, viewport)` in `core` assigns members to spots deterministically by join order. Garden desktop: stepping stones around a pond, extending along a gravel path beyond 8 members; mobile: one column down the path. Sky follows the viewer's local clock.

Performance budget: 60 fps with 24 pets. Only transform/opacity animate; no SVG filters on pets; off-screen pets pause animations (`content-visibility` + IntersectionObserver); hidden tab stops timers; one `derive` timer per pet.

Accessibility: each pet has a text label ("mika is eating. Agent finished a task 2 min ago."); your own pet's `wave` is announced in a polite live region; reduced motion shows static key poses; visible focus on every control; dark mode via `prefers-color-scheme` with a manual toggle.

## 8. Milestones (each demoed before the next)

1. **Core loop**: `core` derive + tests; CLI `init` + hook script; Worker + PetDO + one BurrowDO; `/b/[id]` showing one pet reacting live.
2. **Shared burrow**: invite links, `join`, multiple members, presence, garden spots for up to 24, mobile layout, second environment (tatami room) and env picker.
3. **Social**: treats and cheers, growth stages, `/p/[id]` share card.
4. **Landing**: scroll story as a walk along the garden path (stops: react, together, grow, privacy at the stone lantern, install); 20 s demo video slot.
5. **Launch kit**: README with demo GIF, Show HN draft, X thread draft.

## 9. Visual direction contract

THESIS: a calm shared garden where every friend's pet sits on its own stepping stone under the real sky, and the agent's state reads from across the room. It refuses the category defaults: pets wandering a generic meadow, a dashboard of status chips, and (per the user) any underground or dirt scene.

OWN-WORLD: day gravel #E6E4DA with raked lines #D3CFC2, night gravel #23262C; sumi ink #26241F; moss #8EA35C; stones #A3A099 / #85827B; pond reflects the sky gradient; maple follows the season (October: momiji #C9573B used only on leaves); stone lantern (toro) glows #FFD58A at night. Pets matte sakura #EFA9BC, matcha #98B062, rice #F4EFE4 with soft top-left light, no outlines. Glass only on UI chrome: name tags, nav, command pill. Zen Maru Gothic (display, pet voice) + Zen Kaku Gothic New (body), Geist Mono for commands. Lowercase voice.

STORY: a visitor sees friends' pets working, eating, and waving in real time, understands "my agent's status, and my friends', at a glance", trusts the one-line privacy payload, and runs one command.

FIRST VIEWPORT: full-bleed garden; sky in the viewer's real time of day across the top third with sun or moon; headline "everyone's agents, one burrow." top-left over the sky with one line of subtext and the frosted command pill; the pond, maple, and 4-5 demo pets on stones below, each with a frosted name tag. Primary action is the copyable `npx burrow-pets init`.

FORM: the glass-burrow direction (candidate 1, IMPECCABLE'S PICK, seed key e3e1e07e) with its environment replaced by the user: zen garden main env, tatami room second. Raised from the declined op-art direction: the garden extends seamlessly as members join, no visible tiling.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## 10. Open decisions (not blocking milestone 1)

- Domain (user to buy) and final API hostname. Until then, `BURROW_API_URL` env with a workers.dev default.
- Growth-stage visuals (milestone 3).
- Which environments come after the tatami room (rooftop was the other candidate).
- Whether milestone 4 needs `gsap`.
- Tokens live in browser localStorage for treats; acceptable for low-stakes data, revisit if accounts arrive.
