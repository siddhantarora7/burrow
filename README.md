# burrow

A tiny pet that reacts live to your coding agent, tells you when the agent is waiting on you, and lives in a garden shared with your friends.

    npx burrow-pets init                 # hatch a pet, install the hooks, get your garden link
    npx burrow-pets init <friend's link> # or move straight into a friend's garden
    npx burrow-pets join <link>          # an existing pet can live in several gardens
    npx burrow-pets open                 # a one-time link that signs this browser in

Your pet eats when Claude Code finishes a task, waves when it needs your input, works on a tiny laptop during long runs, and sleeps when you're away. Friends' pets live in the same garden, so you can see who's shipping, who's stuck, and who fell asleep.

The garden is pixel art: a raked zen garden under Mt Fuji whose light follows your clock, with koi, falling maple leaves, and a stone lantern that glows at night. Click a pet to boop it.

**Waiting on you.** Open your garden from the link `init` or `open` prints and the tab knows which pet is yours: when your agent starts waiting on you, it chimes (after your first click on the page, since browsers keep sound locked until then) and, if you allow it, shows a notification while the tab is in the background. A friend who is signed in can poke your waiting pet, which pings you too. Each tag shows how long that agent waited on its human today ("waited on you 41m today"). The sign-in link works once, for 10 minutes, and carries its code in the URL fragment, which never reaches a server; the browser keeps a token that can only say hello and poke.

**Raise it.** Finished tasks (a run of a minute or more, not every chat reply) and quick replies to a waiting agent earn koban, capped per day. Spend them to feed your pet or play with it, and it grows from baby to grown to evolved. Six species (mochi, tofu, onigiri, dango, taiyaki, dorayaki) in three forms make 18 to find, and each garden fills one catalog together; the ranks panel shows who earned the most this week. Koban are worked out on the server from the same four-field events, so growth costs no privacy.

Claude Code sends no hook when you press Esc, so a run that goes silent shows your pet dozing ("quiet") after 2 minutes and idle after 4.

## Privacy

Each hook sends only `{ "v": 1, "type": "stop", "at": 1791234567890, "session": "3f9a1c0e7b2d" }`. Never your prompts, code, file paths, repo names, or tool names. The server rejects anything else.

## Develop

    npm install               # npm 12+ (npm 11.5 drops a native vitest binding from the lockfile)
    npm run dev:server        # Cloudflare Worker on :8787
    npm run dev:web           # Next.js on :3000
    npm run build:cli
    node packages/cli/dist/cli.mjs init
    npm test                  # unit tests
    npm run smoke             # end-to-end against the local server

The landing page at `/` frames a live demo garden; http://localhost:3000/demo?n=6 shows it full screen with more synthetic pets (up to `n=24`; add `&h=21.5` to preview night).

Monorepo: `packages/core` (state machine, schema), `packages/cli` (`burrow-pets`), `apps/server` (Workers + Durable Objects), `apps/web` (Next.js). Design: `docs/superpowers/specs/2026-10-04-burrow-design.md` and the launch design `docs/superpowers/specs/2026-10-11-burrow-launch-design.md`.

MIT licensed.
