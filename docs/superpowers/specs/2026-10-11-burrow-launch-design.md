# burrow: launch design ("your agent is waiting on you")

Date: 2026-10-11 · Status: decisions approved in conversation (alerts in-tab, pokes with claim, garden as landing, free subdomains first). Supersedes milestones 2–5 of `2026-10-04-burrow-design.md` §8; everything else in that spec still holds.

## 1. Why this changes

Milestone 1 ships a beautiful status display that only ever holds one pet: there is no way for a friend to join a burrow, and nothing pulls you back once the novelty fades. The launch needs one job done well. That job is the one in PRODUCT.md's first line: **know at a glance whether your agent is done or waiting on you, and have your friends notice too.** Everything below serves it; everything else is cut.

Success: a friend runs one command with your link and appears in your garden; when your agent waits, your tab chimes and notifies you, and a friend can poke you; your tag tells you honestly how long your agent waited on you today. Launch evidence comes from a real week of use with real friends, never fabricated.

## 2. Scope

| In | Out (cut, may return after launch) |
|---|---|
| Join a burrow (`init <link>`, `join <link>`) | Tatami room, environment picker |
| Browser sign-in by one-time claim link (`init`, `open`) | Treats, growth stages, `/p/[id]` share card |
| In-tab waiting alerts: chime, notification, title | Web push (tab closed), service worker |
| Pokes: a signed-in friend pokes your waving pet | Presence ("who has the tab open") |
| "waited on you Nm today" on each tag | GitHub login, `link` command, accounts |
| Colour choice in `init` | Hand-drawn sprites (the user's call, not code) |
| Landing page = the demo garden with a headline | Scroll-story landing, video slot |
| Deploy on workers.dev + vercel.app, npm publish | Custom domain (can be pointed later) |
| Launch kit: README GIF, Show HN / X / Reddit drafts | |

## 3. Joining

- `POST /v1/pets` accepts an optional `burrowId`. With it, the new pet joins that burrow instead of creating its own; the server answers 404 if the burrow does not exist and 409 if it already has `MAX_MEMBERS` (24).
- `POST /v1/burrows/:id/join` (pet token) adds an existing pet to another burrow; same 404 and 409. Idempotent.
- CLI: `npx burrow-pets init <link>` hatches straight into a friend's burrow; `npx burrow-pets join <link>` adds an existing pet to one. A link is either a full burrow URL (`…/b/<id>`, any host, fragment ignored) or a bare id. Re-running `init <link>` with a pet already hatched behaves like `join`.
- A pet in several burrows already fans every event out to each (PetDO keeps the list).

## 4. Browser sign-in (claim)

The browser needs to know which pet is yours (for alerts) and to prove it (for pokes). No accounts.

- A **claim** is `<petId>.<code>`, `code` 16 random Crockford chars, valid once for 10 minutes. PetDO stores only `sha256(code)` and its expiry (at most 5 open claims; oldest dropped).
- `POST /v1/pets` returns a claim alongside the token. `POST /v1/claims` (pet token) mints a fresh one for `npx burrow-pets open`.
- The CLI prints the burrow link with the claim in the **fragment**: `…/b/<id>#claim=<petId>.<code>`. Fragments never reach servers or logs.
- The page reads the fragment, removes it with `history.replaceState`, and calls `POST /v1/claim {claim}`. PetDO redeems it once and mints a separate **web token** (`<petId>.<secret>`, hash stored in `webTokens`, at most 10, oldest dropped). The browser keeps `{petId, token}` in localStorage under `burrow:me`.
- Web tokens can only say hello and poke. They cannot post events; the CLI token cannot be recovered from them.
- Redeem attempts are limited to 10 per minute per pet.

## 5. Waiting alerts (in-tab)

- When your own pet changes from any state to `wave`, the page: plays a soft two-note chime (Web Audio, synthesised, no asset), shows a system notification if permission was granted ("kiwi needs you · your agent is waiting"), and the tab title already names the pet.
- A chip in the nav, shown only when signed in, toggles alerts: `alerts on` / `alerts off`. Turning them on asks for notification permission; if denied, the chime and title still work and the chip says `chime only`. The choice persists in localStorage.
- No alert on page load for a pet that is already waving (only transitions), and none while the page is the focused, visible tab except the chime (you are looking at it).
- Reduced motion does not affect alerts; muting is the chip.
- Browsers keep Web Audio locked until the page gets a click or key press, and a second-screen tab is often reloaded and never touched. The first click or key anywhere on the page unlocks sound; until then, with alerts on, the chip reads `click for sound` so a silent chime is never a surprise. Notifications (once permitted) are not affected by this lock, so they still arrive.

## 6. Pokes

- When a friend's pet is waving and you are signed in, its tag reads `press to poke` and pressing it sends `{t: 'poke', to}` over the socket. Your own pet's tag never pokes.
- The socket learns who you are from `{t: 'hello', token}` sent on open; BurrowDO verifies the web token with PetDO and keeps `{me}` in the socket attachment (survives hibernation). It answers `{t: 'welcome', me}` (`me` null when the token is unknown, so the page forgets it).
- BurrowDO accepts a poke only if sender and target are both members, differ, the target's derived state is `wave` right now, and the sender has not poked that target in the last 60 s. Otherwise it is dropped silently.
- Accepted pokes broadcast `{t: 'poke', from, to, serverNow}`. Every viewer sees the target hop; the target's owner, if signed in, gets the alert from §5 worded "jun poked you · your agent is waiting".

## 7. Waited-on-you time

- PetDO folds each event into a **wait ledger** (pure function in `core`): `needs_input` or `error` opens a wait for its session (if none is open); the session's next event of any other type closes it and adds `min(duration, TIMING.waitMaxMs)`. Opens older than `waitMaxMs` are closed at the cap. The total resets when the pet's local day changes.
- PetDO forwards `today = {day, waitedMs, meals}` with each event; BurrowDO stores it on the member and includes it in snapshots and `event` messages.
- Every tag's detail line ends with the day's number when it is at least a minute: "last update 2m ago · waited on you 41m today". It is about the agent waiting on its human, so it reads the same on a friend's tag.

## 8. Colour in init

`init` asks for a colour after the species (the six `PET_COLORS`, default the species colour, `--color` flag for scripts) and sends it with the hatch.

## 9. Landing

`/` becomes the demo garden (synthetic pets, labelled "demo" in the status pill) with the headline "everyone's agents, one burrow." and one line of subtext top-left over the sky, a `privacy` link, and the existing command pill. `/demo` stays for `?n=` previews. The privacy payload panel wraps instead of clipping its closing brace.

## 10. Deploy and launch

- Worker on `burrow-api.<account>.workers.dev`, web on `<project>.vercel.app`; `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` point at each other; the CLI's default API and web URLs become the production ones (env and flags still override for local dev).
- npm publish `burrow-pets`.
- These steps need the user's accounts; they are scripted as a wizard the user runs.
- Launch kit: README with a GIF of the garden, Show HN, X thread and r/ClaudeAI drafts. Numbers in them come only from the dogfooding week.

## 11. Testing

- `core`: wait ledger (open/close, cap, day reset, parallel sessions, out-of-order arrival), link parsing.
- `server`: hatch-with-burrow validation, claim code parsing and expiry, the poke guard as a pure function.
- `web`: reducer handles `welcome`, `poke` and `today`; alert transitions are a pure function (no alert on first load, alert on transition into wave, poke alert only for me).
- `cli`: link parsing, colour prompt mapping.
- Smoke: two pets in one burrow over the real Worker: second pet hatches with the first's link, a claim is redeemed, hello is welcomed, a poke on a waving pet is broadcast, `today.waitedMs` grows after the wait closes, privacy still asserted on the wire.

## 12. New milestones

| # | Milestone | Done when |
|---|---|---|
| 2 | **Together** | join, claim, alerts, pokes, waited-today, colour; tests and smoke green |
| 3 | **Front door** | landing garden, privacy panel fix, a11y list wording; screenshots checked |
| 4 | **Ship** | deployed, published, launch kit drafted; then a week of real use before posting |
