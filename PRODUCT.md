# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated to Claude and approved 2026-10-04: TypeScript npm-workspaces monorepo; Next.js (App Router) on Vercel for web; Cloudflare Workers + Durable Objects for realtime and storage; zero-dependency Node CLI published as `burrow-pets`. Details in `docs/superpowers/specs/2026-10-04-burrow-design.md`.

## Users

Developers who run an AI coding agent (Claude Code first) for long stretches, often with a second screen. They pair or co-work loosely with a few friends (classmates, indie hackers, small teams, Discord groups) and want to know two things at a glance: is my agent done, or is it waiting on me; and are my friends working right now.

Secondary audience: startup founders and hiring managers evaluating the project as a portfolio piece. They judge craft, product sense, and engineering quality in a few minutes.

## Product Purpose

Each developer has a small pet that reacts live to their coding agent. It eats when the agent finishes a task, waves when the agent needs input, works on a tiny laptop during long runs, and sleeps when nobody is around. Friends' pets live together in a shared burrow, a web page kept open on a second screen. When a friend's agent ships something, your pet cheers.

Success: a person runs one command, sees their pet react within seconds, sends the burrow link to friends, and keeps the tab open the next day. Launch success is one strong public post (Show HN, X, r/ClaudeAI).

## Positioning

Single-player coding pets already exist (Anthropic's /buddy, Tamamon, others). burrow's differentiator is the shared space: friends' pets living together and reacting to each other's agents in real time, giving a "study with me" feeling for agentic coding. Built around the burrow, not the individual pet.

## Operating Context

- The burrow tab lives on a second monitor or a phone propped beside the keyboard, glanced at, not read.
- Setup happens in a terminal: `npx <package> init` installs Claude Code hooks.
- Sharing happens through invite links pasted into group chats, and pet cards posted on social media.

## Capabilities and Constraints

- Hooks send only event type, timestamp, and an anonymous session id. Never prompts, code, file paths, or repo names. This guarantee is visible in CLI output and on the landing page.
- No account required to start: the CLI hatches a pet with a device token. GitHub login is deferred past launch.
- Pet state is derived by a deterministic, unit-tested state machine with debouncing.
- Social: treats and cheers between pets, light growth/evolution (2–3 stages for v1), per-user share card.
- Mobile-friendly burrow view, dark mode, prefers-reduced-motion, accessible focus states, 60fps with 10+ pets.
- Ask before adding any dependency that is not clearly worth it.
- npm name `burrow` is taken (placeholder). Package name undecided: candidates `burrow-pets`, `getburrow`. Domain undecided: candidates burrow.party, getburrow.dev (unverified availability).
- Timeline: about two weeks to launch.

## Brand Commitments

- Name: burrow, lowercase.
- Voice: lowercase, warm, short. Pets may narrate in first person.
- Craft reference: nudgy.run's design discipline (one minimal mascot, personality from tiny changes, two fonts, scroll storytelling, hand-drawn annotations). Do not reuse its blob mascot, fonts, blue-sky palette, or copy.
- Environments: the shared space is not literally underground. No soil/dirt scenes. Main environment is a zen garden.
- User-stated visual vocabulary (binding direction, to be synthesized, not stacked): imperfect hand-made art, squishy minimalism with a modern feel, color concentrated in pets and environment, Japanese / japandi calm, a retro touch, sleek and clean, optional pixel-art accents, optional glass.

## Evidence on Hand

None yet. No users, testimonials, metrics, or press. Do not fabricate any. Demo data (pets, friends, events) is allowed when labeled as a demo.

## Product Principles

1. Glance first: state must be readable from across a desk in under a second.
2. The burrow is the product: every feature should make the shared space feel more alive.
3. Privacy is visible, not promised: show exactly what is sent.
4. Small and finished beats broad and rough.
5. Personality from tiny changes: posture and timing over detail.

## Accessibility & Inclusion

Respect prefers-reduced-motion and prefers-color-scheme, visible keyboard focus, WCAG AA contrast. Pet state must never rely on animation or color alone; each state has a text label for screen readers.
