# Launch drafts

Every number in brackets comes from the dogfooding week with real friends. Do not post until each one is real; delete a line rather than guess.

## Show HN

**Title:** Show HN: Burrow – a pixel pet that tells you when Claude Code is waiting on you

**Text:**

I run Claude Code for long stretches and kept losing time to one thing: the agent stopped to ask for permission while I was in another window, and sat there. Burrow is a small fix for that, plus some company.

`npx burrow-pets init` installs Claude Code hooks and hatches a pixel-art pet. Keep its garden open on a second screen: the pet works on a tiny laptop while your agent runs, eats when it finishes, and waves when it needs you. The tab chimes and can notify you. Friends' pets live in the same garden (`init <their link>`), so you see who's shipping, and a friend can poke you when your agent has been waiting.

Over a week with [N] friends, our agents waited on us for [X] minutes a day on average; [one honest observation about whether alerts and pokes changed it].

Privacy was the design constraint. Each hook sends exactly `{"v":1,"type":"stop","at":…,"session":"<salted hash>"}`, and the server rejects any other key. No prompts, code, paths or tool names ever leave your machine. Claude Code fires no hook when you press Esc, so a run that goes silent dozes after 2 minutes instead of pretending to work.

Stack: Cloudflare Workers + Durable Objects (one per pet and per garden, hibernating WebSockets), Next.js, a canvas renderer at ~190 px tall scaled by whole numbers with day/dusk/night palette swaps. The state machine is a pure function shared by server and browser.

Demo (synthetic pets): [WEB_URL] · Code: [repo URL]

## X thread

1. my coding agent kept stopping to ask permission while i was in another tab. so i made it a pet that waves at me. [GIF of the garden]
2. `npx burrow-pets init` → a pixel pet that works while Claude Code runs, eats when it finishes, waves when it needs you. the tab chimes.
3. friends' pets share the garden. you see who's shipping, and you can poke a friend whose agent has been waiting on them. [GIF of a poke]
4. each hook sends 4 fields: type, time, a salted session hash, a version. never your code. the server rejects anything else.
5. a week with [N] friends: our agents waited on us [X] min a day. [observation]. try it: [WEB_URL]

## r/ClaudeAI

**Title:** I made a pixel pet for Claude Code that waves when the agent is waiting on you (and friends can share the garden)

**Body:** the Show HN text, minus the stack paragraph, plus one screenshot at night (`?h=21.5`).

## Before posting

- [ ] README GIF: 20 s of the garden with a wave, a poke and a ripple (record on a real burrow).
- [ ] A week of real use with real friends; fill every bracket above.
- [ ] `scripts/ship.sh` done; `npx burrow-pets init` works from a clean machine.
