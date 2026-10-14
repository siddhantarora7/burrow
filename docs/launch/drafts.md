# Launch drafts

Numbers in [brackets] come from the friends' week. Fill them with real numbers or delete the line; never guess.

Voice: lowercase, short, a person who made a thing. One GIF or clip per post. Different words in every community.

## Before posting

- [x] **Publish CLI 0.2.0 first** (done 2026-10-13).
- [ ] Before mentioning stats or the status line: deploy the API, push the site, publish CLI 0.3.0.
- [ ] Push the new site only after that (pushing `main` deploys it).
- [ ] A week with friends; fill every bracket.
- [ ] Clips: the hero loop, a real poke, a pet evolving. `docs/garden.gif` covers the garden.

## Where it's going (the vision paragraph)

Paste this, or a slice of it, wherever a post has room. These are plans, so they are worded as plans.

> what's next: more pets (melonpan, kakigori and ramune are sketched), forms that branch on how you raise them (a pet you mostly feed grows differently from one you mostly play with), seasonal looks for spring, summer, autumn and winter, and things to spend koban on for the garden itself: lanterns, bonsai, new koi. further out: a desk pet that lives in your menu bar so you don't need the tab, support for other agents beyond Claude Code, and a weekly garden goal you hit together. tell me which one you want first.

## New in 0.3 (for any post that has room)

> burrow now lives in Claude Code's status line too: your pet, your day, Claude's 5h / 7d limits, and a heads-up when a friend's agent is stuck. `npx burrow-pets stats` prints the garden as a table (tasks, active time, how long agents waited on you, how fast you answered). Token and cost totals are there if you opt in; koban still only rewards finished work.

## Show HN

**Title:** Show HN: Burrow – a pixel pet that waves when Claude Code is waiting on you

**Text:**

I kept switching tabs while Claude Code worked, then coming back to find it had been sitting on a permission prompt for twenty minutes. So I made the waiting visible: a pixel pet that works while the agent runs, eats when it finishes, and waves (and chimes) when it needs you.

`npx burrow-pets init` installs the hooks and hatches the pet. Friends can move their pets into your garden, see whose agent is stuck, and poke them. Finished runs and quick answers earn koban; feeding and playing grows the pet from baby to grown to evolved, and each garden fills a catalog of 18 forms.

Over a week with [N] friends our agents waited on us [X] minutes a day on average. [one honest line on whether the chime and pokes changed that.]

Privacy: each hook sends `{"v":1,"type":"stop","at":…,"session":"<salted hash>"}` and the server rejects any other key. No prompts, code, paths or tool names. Claude Code fires no hook on Esc, so an interrupted run shows the pet dozing after two minutes.

Built on Cloudflare Workers with a Durable Object per pet and per garden (hibernating WebSockets), Next.js, and a canvas renderer that draws at ~190 px tall and scales by whole numbers, with day, dusk and night palettes.

Next I want branching evolutions, seasonal forms and a menu-bar pet so it works without a tab. Feedback on the pacing of the koban very welcome.

Site: https://burrow-taupe.vercel.app · Code: https://github.com/siddhantarora7/burrow

**First comment (post it yourself right away):** why I built it in two lines, what's rough (Esc, koban pacing is a first guess, per-garden leaderboards only), what I'd like feedback on.

## r/ClaudeAI

Flair: the showcase or "built with Claude" flair, whichever the sub uses.

**Title:** my Claude Code agent kept waiting on me, so now a pixel mochi waves at me instead

**Body:**

you know the thing where you tab away while Claude works, and come back 20 minutes later to "Do you want to proceed?" sitting there the whole time.

burrow is a tiny pet that reacts to Claude Code through hooks. it types on a little laptop while the agent works, eats when the task is done, and waves + chimes the second Claude needs you. the tab title changes too, so you catch it from any window.

friends' pets live in the same garden. you can see whose agent is stuck and poke them.

there's a small game on top: finished tasks and quick replies earn koban, koban buys food, and your pet grows from baby to grown to evolved. six pets, 18 forms to collect with your friends.

privacy was the first thing I designed. the hook sends four fields (type, time, a salted session id, a version). never prompts, code or paths, and the server rejects anything else.

`npx burrow-pets init` · https://burrow-taupe.vercel.app · open source, no account

[vision paragraph, trimmed to two lines]

[GIF: the hero loop or the garden at dusk]

## r/ClaudeCode

**Title:** I turned Claude Code's hooks into a pet that tells you when the agent is blocked

**Body:**

small hooks project that might be useful to anyone running long sessions.

burrow registers eight hooks: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolBatch`, `Notification`, `Stop`, `StopFailure` and `SessionEnd`. each one posts a four-field event: type, timestamp, a salted session hash, a version. a pure state machine turns those into what your pet is doing: working, waiting on you, done, asleep. the same function runs on the server and in the browser.

the part I use most: when a `Notification` lands (permission prompt, question), the pet waves, the tab chimes and the title becomes "kiwi needs you". each pet's tag tracks how long its agent waited on you today. mine was [X] minutes before I started using it.

gotcha I hit: Claude Code fires no hook when you press Esc, so a run that just stops shows as "quiet" after 2 minutes. if anyone knows a cleaner signal for interrupts, I'd love it.

`npx burrow-pets init` to try it, `npx burrow-pets uninstall` removes the hooks. code: https://github.com/siddhantarora7/burrow

## r/SideProject

**Title:** I spent two weeks drawing pixel food pets so my coding agent could get my attention

**Body:**

the problem was tiny and annoying: my AI agent would stop to ask permission, I'd be in another tab, and it would just sit there.

the fix grew a little. it's now a garden where your pet (a mochi, tofu, onigiri, dango, taiyaki or dorayaki) reacts live to your agent, your friends' pets live next to it, and you raise them with coins earned from actually finishing work.

things I learned:
- pixel art at integer scales only, or it turns to mush. the whole garden is drawn at ~190 px tall and scaled up by whole numbers.
- a pure function for "what is my pet doing" made everything easier to test. it runs on the server and in the browser.
- the game only works if it rewards the right thing. coins come from finished tasks and quick replies, never from burning tokens.

https://burrow-taupe.vercel.app · https://github.com/siddhantarora7/burrow

where it goes next is up to whoever uses it: [vision paragraph]

## r/pixelart

A different post entirely: the art, not the product. Check the sub's rules on links; put the link in a comment only if allowed.

**Title:** six food pets, three growth stages each (32×32)

**Body:** drew these for a little coding tool: mochi, tofu, onigiri, dango, taiyaki and dorayaki, each as a baby, grown and evolved. the evolved forms get one signature detail (sakura blossom, green onion, umeboshi, mitarashi glaze, golden fin, a stamped mark). they live in a raked zen garden with a day, dusk and night palette. C&C welcome, especially on the babies.

[image: the 18-form sheet, nearest-neighbour upscaled]

## Discord: Claude / Anthropic community (showcase channel only)

> made a thing for long Claude Code sessions 🍡
>
> **burrow**: a pixel pet that waves when your agent is waiting on you. it works while Claude runs, eats when it's done, chimes when Claude asks for permission. friends share one garden and can poke each other when someone's agent is stuck.
>
> also a tiny tamagotchi: finished tasks earn koban → feed it → it evolves. 18 forms to collect.
>
> hooks send 4 fields, never code. `npx burrow-pets init`
> https://burrow-taupe.vercel.app
>
> next up: branching evolutions + seasonal forms. what would you want your pet to do?

## Discord: a dev server you're already in

> anyone else lose 20 minutes to a "Do you want to proceed?" they didn't see?
>
> I built burrow for that. a little pixel pet reacts to Claude Code in real time and waves at you when the agent's blocked. if you run it with friends you all share a garden, and you can poke whoever's agent is stuck.
>
> one command, no account: `npx burrow-pets init`. here's a live demo garden: https://burrow-taupe.vercel.app#garden

## X thread

1. my coding agent kept waiting on me while I was in another tab. so I gave it a pet that waves. [hero loop clip]
2. `npx burrow-pets init`. the pet works while Claude Code runs, eats when it's done, and waves the moment Claude needs you. the tab chimes.
3. friends' pets live in the same garden. see whose agent is stuck, poke them. [poke clip]
4. finished tasks and quick replies earn koban. feed it, play with it, watch it evolve. 18 forms to collect. [evolution clip]
5. the hook sends 4 fields: type, time, a salted session id, a version. never your code.
6. a week with [N] friends: our agents waited on us [X] min a day. [observation]
7. next: branching evolutions, seasonal forms, a menu-bar pet. what should it do next? https://burrow-taupe.vercel.app
