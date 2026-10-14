# burrow-pets

A tiny pet that reacts live to Claude Code, in a garden shared with your friends.

    npx burrow-pets init                 # hatch a pet and get your garden link
    npx burrow-pets init <friend's link> # or move into a friend's garden
    npx burrow-pets join <link>          # live in another garden too
    npx burrow-pets open                 # sign a browser in for waiting alerts and pokes
    npx burrow-pets rename <name>        # a new name, in every garden, nothing restarts
    npx burrow-pets stats [--week]       # your garden's day or week as a table
    npx burrow-pets statusline on        # your pet and friends in Claude Code's status line
    npx burrow-pets usage on             # share token and cost totals with your garden (off by default)

Pick from six species (mochi, tofu, onigiri, dango, taiyaki, dorayaki); finished tasks and quick replies earn koban that grow your pet.

Each hook sends only `{ "v": 1, "type": "stop", "at": 1791234567890, "session": "3f9a1c0e7b2d" }`.
Never your prompts, code, file paths, repo names, or tool names. With `usage on`, stops also carry `"usage": { "tokens", "cost" }`: tokens summed on your machine from Claude Code's transcript, cost from Claude Code's own estimate. Run `npx burrow-pets privacy` to see the full list.
