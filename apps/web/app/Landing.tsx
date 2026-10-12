'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CopyButton, Mark } from '@/components/BurrowView'
import { ArrowRight, Bell, GitHub, ShieldCheck, Sparkles, Users } from '@/components/icons'
import { INIT } from '@/lib/commands'

const REPO = 'https://github.com/siddhantarora7/burrow'

// The frame previews the garden at one hour; "now" follows the visitor's own clock like a real burrow.
const HOURS = [
  { label: 'now', h: null },
  { label: 'day', h: 10 },
  { label: 'dusk', h: 18.5 },
  { label: 'night', h: 22 },
] as const

const POINTS = [
  { Icon: Bell, title: 'waves when it needs you', body: 'your pet works while Claude Code runs and eats when it finishes. when the agent stops to ask, it waves and the tab chimes.' },
  { Icon: Sparkles, title: 'raise it together', body: 'finished tasks and quick replies earn koban. feed it and play with it, watch it grow from baby to evolved, and fill one catalog of 18 forms with your friends.' },
  { Icon: Users, title: 'one garden for friends', body: "friends' pets live in the same garden. see who's shipping and who's stuck, and poke a friend whose agent is waiting." },
  { Icon: ShieldCheck, title: 'four fields, never your code', body: 'each hook sends a type, a time, a salted session id and a version. the server rejects anything else.' },
]

function Command() {
  return (
    <div className="mx-auto flex h-12 w-fit max-w-full items-center gap-3 rounded-full border border-[var(--line)] bg-[var(--raised)] py-1 pl-5 pr-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <span className="select-none font-mono text-sm text-[var(--muted)]" aria-hidden="true">$</span>
      <code className="truncate font-mono text-sm leading-none sm:text-[15px]">{INIT}</code>
      <CopyButton text={INIT} className="h-9 px-4 text-[13px]" />
    </div>
  )
}

/** The front door: what burrow is in two lines, one command, and a live demo garden in a frame. */
export function Landing() {
  const [hour, setHour] = useState<(typeof HOURS)[number]['label']>('now')
  const h = HOURS.find((x) => x.label === hour)!.h
  // a phone-width frame is a portrait garden, one pet per row: two fit on one screen of it, five would scroll
  const [pets, setPets] = useState<number | null>(null)
  useEffect(() => setPets(matchMedia('(max-width: 639px)').matches ? 2 : 5), [])
  return (
    <div className="on-page min-h-[100dvh] font-display">
      <header className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <Mark />
          burrow
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm font-medium text-[var(--muted)]">
          <Link href="/privacy" className="rounded-full px-3 py-2 transition-colors hover:text-[var(--ink)]">privacy</Link>
          <a href={REPO} className="flex items-center gap-1.5 rounded-full px-3 py-2 transition-colors hover:text-[var(--ink)]">
            <GitHub />
            <span className="lbl">github</span>
          </a>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-5 pb-12 pt-12 text-center sm:pt-20">
          <p className="mx-auto mb-5 w-fit rounded-full border border-[var(--line)] px-3 py-1 text-[13px] font-medium text-[var(--muted)]">for Claude Code</p>
          <h1 className="text-balance text-[2.6rem] font-bold leading-[1.05] tracking-[-0.03em] sm:text-7xl">a tiny pet for your coding agent.</h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty font-sans text-lg leading-relaxed text-[var(--muted)] sm:text-xl">
            it works while your agent runs, waves the moment it needs you, and grows as you ship. your friends&apos; pets share the garden.
          </p>
          <div className="mt-9">
            <Command />
          </div>
          <Link href="/privacy" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)]">
            what gets sent <ArrowRight size={14} />
          </Link>
        </section>

        <section className="mx-auto max-w-6xl px-3 sm:px-8" aria-label="a live demo garden">
          <div className="overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--soft)] shadow-[0_2px_4px_rgba(0,0,0,0.04),0_30px_80px_-20px_rgba(38,36,31,0.35)]">
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

        <section className="mx-auto grid max-w-4xl gap-10 px-5 py-24 sm:grid-cols-2 sm:gap-x-14 sm:gap-y-12 sm:px-8 sm:py-32">
          {POINTS.map(({ Icon, title, body }) => (
            <div key={title}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--soft)]">
                <Icon size={20} />
              </span>
              <h2 className="mt-4 text-lg font-bold">{title}</h2>
              <p className="mt-2 font-sans text-[15px] leading-relaxed text-[var(--muted)]">{body}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-28 text-center">
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
