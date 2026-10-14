# burrow: stats, the status line, and a way home (milestone 4)

Status: draft for review, 2026-10-13. Builds on the launch and grow designs; everything there still holds unless this says otherwise.

## Why

ccclub and status-line tools show cost and tokens. burrow can do better because it already knows what they don't: how long your agent waited on you, how fast you answered, what got finished, and what your friends are doing right now. This milestone puts those numbers where you already look (Claude Code's status line and your terminal) and in the garden, and adds cost and tokens for people who choose to share them.

## Decisions (user's choices)

1. **Stats from events for everyone; cost and tokens are opt-in.** Default behaviour sends exactly what it does today.
2. **Three surfaces:** the Claude Code status line, a `stats` terminal table, a stats panel in the garden.
3. Koban stays tied to finished work and quick replies. Spend is shown, never rewarded or ranked for koban.

## What Claude Code gives us (verified against the docs, 2026-10-13)

- **Status line** commands get JSON on stdin with `session_id`, `model.display_name`, `cost.total_cost_usd` (Claude Code's own estimate for the session), `context_window.used_percentage`, and for Pro/Max `rate_limits.five_hour` / `seven_day` (`used_percentage`, `resets_at`). It re-runs on events (300 ms debounce, in-flight runs cancelled) and on an optional `refreshInterval`.
- **Hooks** get no cost or token fields, only `transcript_path`. The transcript JSONL records `message.usage` (`input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`) on assistant lines; one message spans several lines with the same `message.id`, and the file can lag the hook slightly.

## 1. Stats from events (everyone)

Computed in PetDO from the events it already stores, per pet-local day, next to the wait ledger. `Today` grows from `{ waitedMs, ... }` into:

| Field | Meaning |
|---|---|
| `turns` | `prompt` events |
| `tasks` | stops ending a run of 60 s or more (the koban rule, uncapped) |
| `activeMs` | time between a session's consecutive events while it is not waiting, counting gaps of 2 min or less (the "quiet" threshold) |
| `waitedMs` | as today |
| `replies`, `replyMs` | waits you closed and their total length, so the average reply time is `replyMs / replies` |
| `hours` | 24 numbers: active minutes in each local hour, for the activity strip |
| `tokens?`, `costUsd?` | only for pets sharing usage (section 2) |

- PetDO keeps the last 7 days; `week` is their sum (hours summed per hour of day).
- `today` and `week` go out with every `event` message and in snapshots, as `today` does now.

## 2. Cost and tokens (opt-in)

- **Turning it on:** `init` asks once, default no: "share token and cost totals with your garden? (y/N)". `npx burrow-pets usage on|off` changes it any time. `privacy` prints the current setting.
- **Tokens:** on `stop` (and `session_end`), the hook reads the session's transcript from the byte offset it stopped at last time, sums the four token counts per unique `message.id`, and remembers the new offset and last id in `~/.burrow/sessions/<hash>.json`. Nothing from the transcript is kept or sent except that sum.
- **Cost:** only from Claude Code's own estimate. The burrow status line (section 3) writes the session's `cost.total_cost_usd` to the same local file; the next stop sends the increase since the last one sent. Without the burrow status line, cost is unknown and shows as "–" (tokens still count). No price table of our own, so it never goes stale.
- **Wire:** a `stop` or `session_end` event may carry one more key, `usage: { tokens?: integer 0..50M, cost?: number 0..500 }`, the deltas since the last event. Any other key is still rejected, and `usage` on any other type is rejected. The server is deployed before the CLI that sends it.
- Usage numbers are self-reported and could be faked, so they are labelled as such in the panel's footnote and never change koban or ranks.

## 3. The status line

`npx burrow-pets statusline` is the command Claude Code runs. `init` offers to install it: if you have no status line, burrow's becomes it; if you have one, burrow wraps it (`statusline --then '<your command>'`), printing your line first and burrow's under it. `uninstall` restores the previous setting.

Output (ANSI colours, one line, a second only when a friend needs attention):

```
(•ᴗ•) kiwi working · 🪙 24 · 2h14m active · waited 6m · $13.50 · 5h 41% · 7d 32%
ada needs you 4m · jun working · mo asleep
```

- Your pet's face (the CLI's existing `FACE`) and state, koban, today's active time and wait, cost when shared, and Claude Code's own 5h / 7d use when present (so wrapping a rate-limit line is optional).
- Friends come from a local cache, `~/.burrow/garden.json`. When it is older than 20 s the command starts a detached background refresh (`GET /v1/burrows/:id/snapshot`, the same snapshot the page gets) and prints the cached version straight away. It never blocks on the network. The install sets `refreshInterval: 15`.
- Pet states are derived with the same `@burrow/core` state machine the server and browser use.

## 4. The terminal table

`npx burrow-pets stats [--week] [link]` (your first garden by default):

```
  kiwi's garden · today · 3 members · 1 waiting on you

  #  name   active   tasks  turns  waited  replies  tokens  cost
  1  ada    3h02m    14     61     22m     41s      213M    $84.82
  2  kiwi   2h14m    9      14     6m      18s      23.9M   $13.50
  3  jun    0m       0      0      –       –        –       –

  activity (24h)
  ada   ▁▁▁▁▁▁▁▂▁▁▁▁▁▁▁▃▅▇▆▂▁▁▁▁
  kiwi  ▁▁▁▁▁▁▁▁▁▁▃▁▁▁▁▁▂▅▃▁▁▁▁▁

  garden  https://burrow-taupe.vercel.app/b/…
  invite  npx burrow-pets init https://burrow-taupe.vercel.app/b/…
```

Sorted by tasks finished, then active time. `–` where a pet doesn't share usage.

## 5. The garden

- **Stats panel:** a `stats` nav button (bar-chart icon, label from `md`) next to catalog and ranks, opening the same native dialog: a `today / week` toggle and one row per member with sprite, name, active, tasks, waited, average reply, and tokens and cost when shared, plus a 24-bar activity strip under each row. Your row is tinted.
- **Tags:** hovering or focusing a tag adds "2h active · 9 tasks" to the detail line.
- **A way home:** when a signed-in browser opens a garden its pet lives in, the page remembers that garden's id (`burrow:home` in localStorage, next to the saved pet). The landing page nav then shows **my garden**, linking straight to it. The CLI's `open` and `status` stay the way in from the terminal.

## Protocol

- `Today` gains the fields above; `Member.week?: Today`.
- `WireEvent.usage?` on `stop` / `session_end` only.
- `GET /v1/burrows/:id/snapshot` returns the snapshot JSON (public, like the page).

## Privacy and copy

- Default: unchanged, four fields. The privacy page, the landing's privacy cards, `npx burrow-pets privacy`, README and the drafts say: "if you turn on usage sharing, stops also carry two numbers: tokens and Claude Code's cost estimate. still never prompts, code or paths."
- Stats are visible to anyone with the garden link, like the garden itself; the panel says so.

## Testing

- core: every `Today` field from event sequences (active gaps, waits, midnight rollover, 7-day window); `usage` parsing (allowed only on stop/session_end, bounds, unknown keys still rejected).
- cli: transcript summing (duplicate ids, partial last line, offset resume, missing file); cost delta from the status line file; status line output with and without usage, with and without rate limits, wrapping another command; the stats table formatting and sparkline.
- web: panel rows, sorting, today/week; "my garden" appears only with a saved pet.
- smoke: a stop with `usage` raises the snapshot's tokens and cost; a stop without it doesn't.

## Out of scope

Global leaderboards, billing-accurate cost, Codex or other agents, a menu-bar app, historical charts beyond 7 days.
