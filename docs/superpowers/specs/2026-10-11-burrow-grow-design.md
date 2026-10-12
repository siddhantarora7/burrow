# burrow: pets grow up (milestone 3)

Status: approved in chat on 2026-10-11 (all four recommended answers, then "yes, build it"). Builds on the launch design (`2026-10-11-burrow-launch-design.md`); everything there still holds. This milestone brings back growth stages and treats, which the launch re-plan cut, in a form that rewards the product's job.

## Why

A pet that only mirrors your agent is a toy you glance at. A pet you raise, in a garden you fill with friends, is a reason to keep the tab open, answer your agent quickly, and invite people. The incentive must reward what burrow is for (finished work, short waits), never token spend, and must not weaken the privacy contract.

## Decisions (user's choices)

1. Currency is earned from **finished tasks and quick replies**, computed from the events hooks already send. The wire format stays exactly `{v, type, at, session}`.
2. Leaderboards are **per garden only**. No global board until the server can verify events.
3. **6 species × 3 stages = 18 forms.** Existing mochi, tofu, onigiri plus three new: dango, taiyaki, dorayaki.
4. Built **now, before launch**; the friends' week then measures the real product.

## Economy: koban

All numbers live in `packages/core/src/grow.ts` as `GROW`.

| Source | Pays | Cap per pet-local day |
|---|---|---|
| `stop` (a finished task) | 3 | 30 paid stops |
| A wait (`needs_input` or `error`) closed by that session's next other event within 60 s | 2 | 20 paid replies (shared) |
| ...closed within 3 min | 1 | |

- A wait's length is measured with the same ledger that feeds "waited on you today": the open time before the event, minus the event time. Waits closed by the abandonment cap pay nothing.
- Caps reset at the pet's local midnight (its `tz`). They bound cheating: anyone can post their own events, so faking earns at most 130 koban a day.
- `weekKoban` counts koban earned (not spent) in the pet's ISO week (`2026-W42`) and resets when the week changes. Spending never lowers it.

## Growth

- `xp` only goes up. Stage is derived: `baby` below 100, `grown` from 100, `evolved` from 400.
- **Feed:** costs 5 koban, gives +10 xp. **Play:** costs 3, gives +5. Neither is possible without the koban (nothing happens; the buttons are disabled).
- New pets hatch at 0 xp (baby). A pet without stored growth (hatched before this milestone) starts at 100 xp (grown), so nobody's pet shrinks.
- Typical pace: about 15 tasks and a few quick replies a day is about 55 koban, which is 110 xp of feeding. That means grown in a day or two and evolved within a week.
- Boops and pokes stay free and give nothing.

## Forms and art

- `SPECIES` becomes `mochi, tofu, onigiri, dango, taiyaki, dorayaki`. All six can be picked at `init`; old CLIs keep working because the server only ever validates against the list.
- New colour **kinako** (toasted soybean brown) joins the six; default colours: dango `sora`, taiyaki `yuzu`, dorayaki `kinako`. It obeys the Brighter Pet Rule (tested).
- **Baby:** the grown silhouette scaled to 72% about the feet, face and arms scaled with it; bigger-looking eyes come free from the smaller body.
- **Grown:** today's sprites; the new species are drawn the same way (shape function, shading, outline, face).
  - dango: three balls on a horizontal skewer, the middle one larger and carrying the face.
  - taiyaki: a fish-shaped cake facing left, with a tail and a top fin.
  - dorayaki: two pancakes with a dark anko band low between them, face on the upper one.
- **Evolved:** the grown form plus a signature detail drawn over the outline: mochi a sakura blossom, tofu a green onion sprig, onigiri an umeboshi plum, dango a glossy mitarashi glaze, taiyaki a golden crown fin, dorayaki a stamped mark.
- All 18 forms fit the 32 px grid, keep the 1 px `pet-ink` outline and every state's pose and props.

## Catalog (per garden)

- A form `species:stage` is discovered in a garden once any member is in it. BurrowDO stores the set (`catalog`) and adds to it on join and on growth; it never shrinks, so a pet that evolves or leaves keeps its forms discovered.
- The client shows `snapshot.catalog` plus the live members' forms: a 6×3 grid of sprites, undiscovered ones as an ink silhouette with a "?".

## Leaderboard (per garden)

- Members ranked by `weekKoban` for the current week (the newest `week` among members; others count 0), ties by xp. Each row shows rank, sprite, name, stage and koban this week; your own row is marked.

## Protocol

- `Member.growth?: PetGrowth` with `{ xp, koban, week, weekKoban }`; absent means a pre-milestone pet (grown, 100 xp).
- `event` messages gain `growth?` alongside `today`.
- New server message `{ t: 'grow'; petId; growth; effect: 'feed' | 'play'; serverNow }` after care.
- `snapshot` gains `catalog: string[]`.
- New client message `{ t: 'care'; action: 'feed' | 'play' }`: only from a socket whose hello proved a web token (`me`), only for `me`'s own pet, 30 a minute. Web tokens still can never post events.
- Evolution is not a message: every client sees `stageOf(xp)` rise and plays the moment.

## Server

- PetDO keeps `growth` (the full `Growth`, with today's counters) in storage. `event()` folds `earn()` before the wait ledger and passes the public growth to `ingest`. `care(action, now)` applies `care()` and pushes `grow` to every burrow the pet lives in. `hatch` stores a fresh baby growth; `auth` returns the public growth so `join` shows the right form at once.
- BurrowDO stores each member's `growth`, the `catalog`, and broadcasts `grow`.

## Web

- **Care pill** (signed in, your pet lives here): your pet's name and stage, a thin progress bar to the next stage, your koban with a coin icon, and `feed · 5` and `play · 3` buttons. It sits bottom-right from `sm` and above the invite pill on phones; the one-time hint moves above it.
- **Header:** two more pill buttons, `catalog` (book icon) and `ranks` (trophy icon), labels hidden on phones. Each opens a native `<dialog>` panel in the chip skin (Esc and a close button dismiss it).
- **Effects:** after `grow` with `feed` the pet eats for 2.4 s, with `play` it cheers for 2 s, on every screen. When a member's stage rises the pet bursts gold sparkles and a toast pill says "kiwi grew up!" or "kiwi evolved!" for 4 s (announced politely).
- The demo garden gives its synthetic pets mixed stages and a demo catalog, so the landing frame shows babies and evolved forms.
- Landing: a fourth point, "raise it with your friends", and the forms appear in the frame.

## Testing

- core: stage thresholds, every earning rule and cap, day and week rollover, care costs and refusal, ISO weeks.
- web: the reducer for `grow` and `catalog`, `discovered()` and `ranks()`, sprites for all 18 forms (inside the grid, outlined, baby smaller than grown, evolved adds pixels), the kinako contrast via the existing colour tests.
- smoke: a pet earns from a stop and a quick reply, a signed-in browser feeds it, the burrow sees `grow`.

## Out of scope

Global leaderboards, gifting to friends, items or shops, branching evolutions, trading, any new event type.
