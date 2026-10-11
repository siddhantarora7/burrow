---
version: 1
slug: "apps-web-app-b-id-page-tsx"
primary_target: "apps/web/app/b/[id]/page.tsx"
related_targets: ["apps/web/components/BurrowView.tsx","apps/web/components/PixelBurrow.tsx"]
---

# Surface: burrow page (/b/[id])

Mode: Experience (the live garden is the work itself; kept open on a second screen and glanced at).
Audience: developers running Claude Code who share a burrow with friends.
Job: at a glance, know whose agent is done, working, or waiting on its human; feel company.
Constraints: 60 fps with up to 24 pets; transform/opacity animation only; reduced motion shows static poses; portrait (tall) and landscape (wide) layouts.
Memorable moment: a finished task sends a ripple across the pond while the pet eats; a waiting pet waves with a gold-ringed tag and the tab title names it.

## Direction contract

THESIS: a calm shared garden where every friend's pet sits on its own stepping stone under the real sky, and the agent's state reads from across the room. It refuses the category defaults: pets wandering a generic meadow, a dashboard of status chips, and (per the user) any underground or dirt scene.

OWN-WORLD: day gravel #E6E4DA with raked lines #D3CFC2, night gravel #23262C; sumi ink #26241F; moss #8EA35C; stones #A3A099 / #85827B; pond reflects the sky gradient; maple follows the season (October: momiji #C9573B used only on leaves); stone lantern (toro) glows #FFD58A at night. Pets matte sakura #EFA9BC, matcha #98B062, rice #F4EFE4 with soft top-left light, no outlines. Glass only on UI chrome: name tags, nav, command pill. Zen Maru Gothic (display, pet voice) + Zen Kaku Gothic New (body), Geist Mono for commands. Lowercase voice.

STORY: a visitor sees friends' pets working, eating, and waving in real time, understands "my agent's status, and my friends', at a glance", trusts the one-line privacy payload, and runs one command.

FIRST VIEWPORT: full-bleed garden; sky in the viewer's real time of day across the top third with sun or moon; headline "everyone's agents, one burrow." top-left over the sky with one line of subtext and the frosted command pill; the pond, maple, and 4-5 demo pets on stones below, each with a frosted name tag. Primary action is the copyable `npx burrow-pets init`.

LIVE-PAGE AMENDMENT (2026-10-04, after finish review): the live burrow page is a glance surface, so it drops the marketing headline and subtext; the landing page (milestone 4) carries them. The live page keeps the primary action as a compact frosted "get a pet / npx burrow-pets init / copy" pill and a privacy door in the header. A lone pet is promoted to the focal point; the garden grows with members and fills the viewport instead of cropping.

FORM: the glass-burrow direction (candidate 1, IMPECCABLE'S PICK, seed key e3e1e07e) with its environment replaced by the user: zen garden main env, tatami room second. Raised from the declined op-art direction: the garden extends seamlessly as members join, no visible tiling.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

PIXEL AMENDMENT (2026-10-04): after a spike the user chose pixel art (cozy 16-bit). The OWN-WORLD block in the spec (§9) now governs: canvas scene at ~180 px tall scaled by an integer, palette-swapped day/dusk/night, outlined 32 px pets brighter than the scene, ambient life (koi, clouds, leaves, fireflies, lantern), frosted HTML chrome and tags. The vector garden is retired.
