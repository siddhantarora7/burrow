# Launch plan

Written 2026-10-12. Post copy lives in `drafts.md` (including the vision paragraph on more pets and features); this file is the order of things.

## Where things stand

- Web: https://burrow-taupe.vercel.app (landing, demo, gardens). Deploys from `main` on push, or `npx vercel deploy --prod`.
- API: https://burrow-api.tryburrow.workers.dev. Deploy with `cd apps/server && npx wrangler deploy` (the web address is in `wrangler.jsonc`).
- CLI: `burrow-pets` 0.1.0 on npm (three species). 0.2.0 (six species, growth) is built and waiting for you.
- Repo: `main` has everything, including the README GIF and the share card.

## 1. Before anyone else sees it (you, about 10 minutes)

1. Publish the CLI: `scripts/ship.sh 6`. npm will ask for your two-factor code. Do this **before** the new landing page goes live: it promises six pets and 18 forms, and npm still serves 0.1.0 with three.
2. In a fresh terminal, run `npx burrow-pets init`, pick a dango, open the link it prints, and check that a pet hatches as a baby, the care pill appears and the tab chimes when Claude Code asks for permission.
3. Then push `main` (it deploys the redesigned site) and check the share card with a link preview (paste the URL in a DM to yourself).

## 2. A week with friends (3 to 5 people)

Send each of them `npx burrow-pets init <your garden link>`. Then watch for:

- **Koban pacing.** Does anyone hit the 30-task cap? Do pets grow up in a day or two and evolve within the week? If not, change the constants in `packages/core/src/grow.ts` (pay, caps, costs, thresholds) and redeploy the API.
- **Alerts.** Do the chime and notifications help or annoy? Does anyone poke?
- **Bugs.** Anything odd in the garden, especially around midnight or with many pets.
- **The numbers for the posts.** How many minutes a day agents waited on each person (each pet's tag shows "waited on you Nm today"). Fill the brackets in `drafts.md` with real numbers only.

Worth recording during the week: a short screen capture of a real poke and of a pet growing up. Those are the two best clips for the X thread.

## 3. Launch day (a Tuesday to Thursday, about 8 to 10am US Eastern)

1. **Show HN** first, using the title and text in `drafts.md`. Link straight to the site (no signup in the way, which HN cares about). Right after posting, add a short first comment: why you built it, what's rough, what you'd like feedback on. Stay around for two or three hours and answer everything. Never ask for upvotes. [Rules](https://news.ycombinator.com/showhn.html)
2. **X thread** the same day, with `docs/garden.gif` on the first post and your poke or evolution clip later in the thread.
3. **r/ClaudeAI** and **r/ClaudeCode**, a few hours apart. These are the most direct audiences. Read each subreddit's self-promotion rules and use their project or showcase flair if they have one. Post as a person who made a thing: what it does, one GIF, the privacy line, the link.

## 4. The following days (one place a day, not all at once)

- **r/SideProject**: the story post (why, what you learned building a canvas pixel renderer).
- **r/vibecoding** and **r/ChatGPTCoding**: only if the post is about the workflow ("my agent kept waiting on me"), not an ad.
- **r/coolgithubprojects**: the repo link with one line.
- **r/pixelart**: a different post entirely: the 18-form sheet as original art ("I drew 6 food pets in 3 growth stages for a coding tool"). Link in a comment only if their rules allow it.
- **Discord**: Anthropic's official Claude Discord (get the invite from anthropic.com or claude.ai; post only in a showcase or projects channel if there is one) and any Claude Code community servers you're already in. One post each, no cross-spam.
- **awesome-claude-code**: from 2026-10-18 (lists need 14 days since the first commit). Submit through the [issue form](https://github.com/hesreallyhim/awesome-claude-code/issues/new?template=recommend-resource.yml), one line, no emojis. The hooks-focused lists ([loqimean/awesome-claude-code-hooks](https://github.com/loqimean/awesome-claude-code-hooks) and similar) take PRs.
- **Later, optional**: a dev.to or blog post on how the garden is drawn (palette swaps, Bayer dithering, integer scaling, a 60 fps canvas with 24 pets). That kind of post does well on HN as a second wave. Product Hunt once you have a few real users and quotes.

## Rules for yourself

- Different words for each community; the same post pasted everywhere reads as spam.
- Reply to every comment in the first hours, including the critical ones.
- If someone finds a bug, fix it that day and say so in the thread.

## Known rough edges (say them before others do)

- Claude Code sends no hook when you press Esc, so an interrupted run shows as "quiet" after 2 minutes and idle after 4.
- Koban pacing is a first guess until the friends' week.
- Leaderboards are per garden only; a global one would need event verification.
- Around midnight, a friend in another timezone can show "waited today" a little early or late.
- If two pets join a 23-member garden at the same moment, one can end up without a garden (very rare).
