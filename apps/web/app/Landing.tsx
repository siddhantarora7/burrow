'use client'
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import type { PetState, Species, Stage } from '@burrow/core'
import { CopyButton, Mark } from '@/components/BurrowView'
import { ArrowRight, Bell, Coins, GitHub, ShieldCheck, Sparkles, Terminal, UserPlus, Users } from '@/components/icons'
import { Sprite } from '@/components/Sprite'
import { Stars } from '@/components/Stars'
import { INIT } from '@/lib/commands'
import { toneOf } from '@/lib/pixel/sprites'

const REPO = 'https://github.com/siddhantarora7/burrow'

// The frame previews the garden at one hour; "now" follows the visitor's own clock like a real burrow.
const HOURS = [
  { label: 'now', h: null },
  { label: 'day', h: 10 },
  { label: 'dusk', h: 18.5 },
  { label: 'night', h: 22 },
] as const

/** Pets floating around the headline, each showing one thing a pet does. */
const FLOATERS: Array<{ species: Species; stage: Stage; state: PetState; className: string }> = [
  { species: 'mochi', stage: 'evolved', state: 'wave', className: 'left-[7%] top-[6.5rem] [animation-delay:-1s]' },
  { species: 'onigiri', stage: 'grown', state: 'sleep', className: 'right-[8%] top-[5rem] [animation-delay:-2.5s]' },
  { species: 'taiyaki', stage: 'baby', state: 'cheer', className: 'left-[11%] top-[23rem] [animation-delay:-3.5s]' },
  { species: 'tofu', stage: 'evolved', state: 'work', className: 'right-[10%] top-[21rem] [animation-delay:-0.5s]' },
]

const STEPS = [
  { Icon: Terminal, title: 'hatch', body: <>run <code className="font-mono text-[13px]">npx burrow-pets init</code>. it installs the Claude Code hooks and hatches your pet.</> },
  { Icon: Bell, title: 'keep it open', body: 'leave your garden in a tab. it chimes, and can notify you, the moment your agent waits on you.' },
  { Icon: UserPlus, title: 'invite friends', body: 'send your link. their pets move in, and you raise them side by side.' },
]

const POINTS = [
  { Icon: Bell, title: 'waves when it needs you', body: 'your pet works while Claude Code runs and eats when it finishes. when the agent stops to ask, it waves and the tab chimes.' },
  { Icon: Sparkles, title: 'raise it together', body: 'finished tasks and quick replies earn koban. feed it and play with it, watch it grow from baby to evolved, and fill one catalog of 18 forms with your friends.' },
  { Icon: Users, title: 'one garden for friends', body: "friends' pets live in the same garden. see who's shipping and who's stuck, and poke a friend whose agent is waiting." },
  { Icon: ShieldCheck, title: 'four fields, never your code', body: 'each hook sends a type, a time, a salted session id and a version. the server rejects anything else.' },
]

function Command({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`raised mx-auto flex h-14 w-fit max-w-full items-center gap-3 rounded-full py-1 pl-6 pr-2 ${dark ? 'raised-dark' : ''}`}>
      <span className="select-none font-mono text-[15px] opacity-50" aria-hidden="true">$</span>
      <code className="truncate font-mono text-[15px] leading-none">{INIT}</code>
      <CopyButton text={INIT} className="h-10 px-4 text-[13px]" />
    </div>
  )
}

/** A little card in the margin of the demo: one real moment from a garden. */
function Moment({ children, title, line, className, alert = false }: { children: ReactNode; title: string; line: string; className: string; alert?: boolean }) {
  return (
    <div className={`moment absolute z-10 hidden items-center gap-3 rounded-2xl py-3 pl-3 pr-5 xl:flex ${alert ? 'moment-alert' : ''} ${className}`} aria-hidden="true">
      {children}
      <span>
        <span className="block text-[15px] font-bold leading-tight">{title}</span>
        <span className="block text-[13px] leading-snug opacity-65">{line}</span>
      </span>
    </div>
  )
}

/** The front door: a night-sky hero with pets around the headline, a live demo garden, how it works. */
export function Landing() {
  const [hour, setHour] = useState<(typeof HOURS)[number]['label']>('now')
  const h = HOURS.find((x) => x.label === hour)!.h
  // a phone-width frame is a portrait garden, one pet per row: two fit on one screen of it, five would scroll
  const [pets, setPets] = useState<number | null>(null)
  useEffect(() => setPets(matchMedia('(max-width: 639px)').matches ? 2 : 5), [])

  return (
    <div className="on-page min-h-[100dvh] font-display">
      <section className="night relative overflow-hidden pb-40 sm:pb-56">
        <Stars />
        <Stars twinkle />
        <header className="relative z-10 mx-auto flex max-w-6xl items-center gap-2 px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <Mark />
            burrow
          </Link>
          <nav className="navgroup ml-auto flex items-center gap-1 rounded-full p-1 text-sm font-medium">
            <a href="#how" className="hidden rounded-full px-3.5 py-2 transition-colors hover:bg-white/10 sm:block">how it works</a>
            <Link href="/privacy" className="hidden rounded-full px-3.5 py-2 transition-colors hover:bg-white/10 sm:block">privacy</Link>
            <a href={REPO} className="flex items-center gap-1.5 rounded-full px-3.5 py-2 transition-colors hover:bg-white/10" aria-label="github">
              <GitHub />
              <span className="hidden sm:inline">github</span>
            </a>
            <a href="#start" className="rounded-full bg-[#f1eee6] px-4 py-2 font-bold text-[#26241f] transition-opacity hover:opacity-90">get a pet</a>
          </nav>
        </header>

        {FLOATERS.map((f) => (
          <div key={f.species} className={`floater absolute hidden lg:block ${f.className}`} aria-hidden="true">
            <Sprite species={f.species} color={toneOf(f.species, undefined)} stage={f.stage} state={f.state} size={128} animate />
          </div>
        ))}

        <div className="relative z-10 mx-auto max-w-3xl px-5 pt-14 text-center sm:pt-24">
          <h1 className="text-balance text-[2.5rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-7xl">
            your agent is waiting,
            <br />
            your pet waves.
            <Sprite species="mochi" color="sakura" state="wave" size={60} animate className="-my-4 ml-1 inline-block align-middle sm:-my-8 sm:ml-3 sm:!size-[96px]" />
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty font-sans text-lg leading-relaxed text-[#c9cbe0] sm:text-xl">
            burrow is a tiny pixel pet for Claude Code. it works while your agent runs, waves the moment it needs you, and grows as you ship, in a garden shared with your friends.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Command dark />
            <a href="#demo" className="flex h-14 items-center gap-2 rounded-full border border-white/25 px-6 text-[15px] font-bold transition-colors hover:bg-white/10">
              see a live garden <ArrowRight size={16} />
            </a>
          </div>
          <p className="mt-5 text-[13px] text-[#9ea2c2]">
            free and open source. no account. <Link href="/privacy" className="underline underline-offset-4 hover:text-white">four fields, never your code.</Link>
          </p>
        </div>
      </section>

      <main>
        <section id="demo" className="relative z-10 mx-auto -mt-28 max-w-6xl scroll-mt-8 px-3 sm:-mt-40 sm:px-8" aria-label="a live demo garden">
          <Moment title="kiwi needs you" line="waiting on you for 2m" className="-left-20 top-16 -rotate-3" alert>
            <Sprite species="mochi" color="sakura" state="wave" size={40} />
          </Moment>
          <Moment title="+3 koban" line="jun finished a task" className="-left-12 bottom-28 rotate-2">
            <span className="flex size-10 items-center justify-center"><Coins size={22} className="text-[#d49a2e]" /></span>
          </Moment>
          <Moment title="dora grew up!" line="fed and played with all week" className="-right-16 top-24 rotate-3">
            <Sprite species="dorayaki" color="kinako" stage="grown" state="cheer" size={40} />
          </Moment>
          <Moment title="ada poked you" line="your agent has been waiting 4m" className="-right-10 bottom-20 -rotate-2">
            <Sprite species="tofu" color="matcha" state="idle" size={40} />
          </Moment>

          <div className="overflow-hidden rounded-[28px] border border-[var(--line)] bg-[#0c1230] shadow-[0_2px_4px_rgba(0,0,0,0.06),0_40px_100px_-24px_rgba(12,18,48,0.55)]">
            {pets === null ? <div className="aspect-[3/5] w-full sm:aspect-[16/9]" /> : <iframe
              key={`${hour}-${pets}`}
              src={`/demo?n=${pets}&embed=1${h === null ? '' : `&h=${h}`}`}
              title="a live demo garden with made-up pets"
              className="block aspect-[3/5] w-full sm:aspect-[16/9]"
            />}
          </div>
          <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <p className="text-sm text-[var(--muted)]">made-up pets, the real garden. click one to boop it.</p>
            <div role="group" aria-label="time of day" className="flex rounded-full border border-[var(--line)] p-1 text-[13px] font-medium">
              {HOURS.map((x) => (
                <button
                  key={x.label}
                  type="button"
                  aria-pressed={hour === x.label}
                  onClick={() => setHour(x.label)}
                  className={`lbl h-8 rounded-full px-3.5 transition-colors ${hour === x.label ? 'bg-[var(--ink)] text-[var(--paper)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-5xl scroll-mt-8 px-5 pt-28 sm:px-8 sm:pt-36">
          <p className="text-center text-sm font-medium text-[var(--muted)]">how it works</p>
          <h2 className="mt-3 text-balance text-center text-3xl font-bold tracking-[-0.02em] sm:text-5xl">three steps, one minute.</h2>
          <ol className="mt-12 grid gap-4 sm:grid-cols-3">
            {STEPS.map(({ Icon, title, body }, i) => (
              <li key={title} className="rounded-3xl border border-[var(--line)] bg-[var(--raised)] p-6">
                <span className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--soft)]"><Icon size={20} /></span>
                  <span className="text-[13px] font-bold tabular-nums text-[var(--muted)]">0{i + 1}</span>
                </span>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-1.5 font-sans text-[15px] leading-relaxed text-[var(--muted)]">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-5xl px-5 pt-28 sm:px-8 sm:pt-36">
          <p className="text-center text-sm font-medium text-[var(--muted)]">what it does</p>
          <h2 className="mt-3 text-balance text-center text-3xl font-bold tracking-[-0.02em] sm:text-5xl">it watches your agent, so you don&apos;t have to.</h2>
          <div className="mx-auto mt-14 grid max-w-4xl gap-10 sm:grid-cols-2 sm:gap-x-14 sm:gap-y-12">
            {POINTS.map(({ Icon, title, body }) => (
              <div key={title}>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--soft)]">
                  <Icon size={20} />
                </span>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 font-sans text-[15px] leading-relaxed text-[var(--muted)]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="start" className="mx-auto max-w-3xl scroll-mt-8 px-5 py-28 text-center sm:py-36">
          <div className="mx-auto mb-6 flex w-fit items-end gap-1" aria-hidden="true">
            <Sprite species="dango" color="sora" stage="baby" state="idle" size={56} animate />
            <Sprite species="dorayaki" color="kinako" state="idle" size={72} animate />
            <Sprite species="onigiri" color="rice" stage="evolved" state="idle" size={64} animate />
          </div>
          <h2 className="text-balance text-3xl font-bold tracking-[-0.02em] sm:text-5xl">one command. no account.</h2>
          <p className="mx-auto mt-4 max-w-md font-sans text-[var(--muted)]">it installs the hooks, hatches your pet and prints your garden link. send a friend <code className="font-mono text-[13px]">init &lt;your link&gt;</code> to move in.</p>
          <div className="mt-8">
            <Command />
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-8 text-sm text-[var(--muted)] sm:px-8">
          <span className="font-bold text-[var(--ink)]">burrow</span>
          <span>MIT licensed</span>
          <Link href="/privacy" className="hover:text-[var(--ink)]">privacy</Link>
          <a href={REPO} className="hover:text-[var(--ink)]">github</a>
        </div>
      </footer>
    </div>
  )
}
