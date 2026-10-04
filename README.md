# burrow

A tiny pet that reacts live to your coding agent, in a garden shared with your friends.

Your pet eats when Claude Code finishes a task, waves when it needs your input, works on a tiny laptop during long runs, and sleeps when you're away. Friends' pets live in the same garden, so you can see who's shipping, who's stuck, and who fell asleep.

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

Monorepo: `packages/core` (state machine, schema), `packages/cli` (`burrow-pets`), `apps/server` (Workers + Durable Objects), `apps/web` (Next.js). Design: `docs/superpowers/specs/2026-10-04-burrow-design.md`.

MIT licensed.
