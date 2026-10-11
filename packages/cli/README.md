# burrow-pets

A tiny pet that reacts live to Claude Code, in a garden shared with your friends.

    npx burrow-pets init                 # hatch a pet and get your garden link
    npx burrow-pets init <friend's link> # or move into a friend's garden
    npx burrow-pets join <link>          # live in another garden too
    npx burrow-pets open                 # sign a browser in for waiting alerts and pokes

Each hook sends only `{ "v": 1, "type": "stop", "at": 1791234567890, "session": "3f9a1c0e7b2d" }`.
Never your prompts, code, file paths, repo names, or tool names. Run `npx burrow-pets privacy` to see the full list.
