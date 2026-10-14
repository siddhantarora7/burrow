'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { GitHub } from '@/components/icons'
import { Logo } from '@/components/Logo'
import { Sprite } from '@/components/Sprite'
import { Cards } from '@/components/landing/Cards'
import { Evolution } from '@/components/landing/Evolution'
import { Hero } from '@/components/landing/Hero'
import { Privacy } from '@/components/landing/Privacy'
import { Command, Note, REPO } from '@/components/landing/bits'

// The frame previews the garden at one hour; "now" follows the visitor's own clock like a real burrow.
const HOURS = [
  { label: 'now', h: null },
  { label: 'day', h: 10 },
  { label: 'dusk', h: 18.5 },
  { label: 'night', h: 22 },
] as const

function Nav() {
  // set by the garden page once this browser's pet lives there
  const [home, setHome] = useState<string | null>(null)
  useEffect(() => {
    try {
      setHome(localStorage.getItem('burrow:home'))
    } catch {
      // storage blocked: no shortcut home
    }
  }, [])
  const link = 'lbl hidden h-9 items-center rounded-full px-3.5 transition-colors hover:bg-[#26241f]/[0.06] md:flex'
  return (
    <nav className="navbar fixed left-1/2 top-4 z-30 flex h-[52px] -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-full p-1.5 text-[14px] font-medium">
      <Link href="/" className="flex h-9 items-center gap-2 rounded-full pl-2.5 pr-3 font-display text-[17px] font-bold tracking-[-0.03em]" aria-label="burrow home">
        <Logo size={15} />
        <span className="lbl">burrow</span>
      </Link>
      <span className="mx-1 hidden h-5 w-px bg-[#26241f]/10 md:block" aria-hidden="true" />
      <a href="#how" className={link}>how it works</a>
      <a href="#garden" className={link}>garden</a>
      <a href="#privacy" className={link}>privacy</a>
      {home && <Link href={`/b/${home}`} className="lbl flex h-9 items-center rounded-full px-3.5 font-semibold transition-colors hover:bg-[#26241f]/[0.06]">my garden</Link>}
      <a href={REPO} className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-[#26241f]/[0.06]" aria-label="GitHub">
        <GitHub size={17} />
      </a>
      <a href="#start" className="lbl ml-1 flex h-9 items-center rounded-full bg-[#26241f] px-4 font-semibold text-[#f7f4ec] transition-opacity hover:opacity-85">get a pet</a>
    </nav>
  )
}

function Garden() {
  const [hour, setHour] = useState<(typeof HOURS)[number]['label']>('now')
  const h = HOURS.find((x) => x.label === hour)!.h
  // a phone-width frame is a portrait garden, one pet per row: two fit on one screen of it, five would scroll
  const [pets, setPets] = useState<number | null>(null)
  useEffect(() => setPets(matchMedia('(max-width: 639px)').matches ? 2 : 5), [])

  return (
    <section id="garden" className="mx-auto max-w-6xl scroll-mt-24 px-3 pt-24 sm:px-8 sm:pt-32" aria-label="a live demo garden">
      <div className="flex flex-col items-center gap-5 px-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-center font-display text-[2.2rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-left sm:text-[3.4rem]">
          see it live<span className="text-[#a29d92]">.</span>
        </h2>
        <div role="group" aria-label="time of day" className="flex rounded-full bg-white p-1 text-[13px] font-medium shadow-[0_1px_2px_rgba(38,36,31,0.06)] ring-1 ring-[#26241f]/[0.06]">
          {HOURS.map((x) => (
            <button
              key={x.label}
              type="button"
              aria-pressed={hour === x.label}
              onClick={() => setHour(x.label)}
              className={`lbl h-8 rounded-full px-3.5 transition-colors ${hour === x.label ? 'bg-[#26241f] text-[#f7f4ec]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative mt-8">
        <span className="absolute -bottom-12 right-10 z-10 hidden rotate-2 sm:block"><Note dir="up-left">boop a pet</Note></span>
        <div className="overflow-hidden rounded-[32px] bg-[#e9e4d6] shadow-[0_1px_2px_rgba(38,36,31,0.06),0_40px_90px_-30px_rgba(38,36,31,0.4)] ring-1 ring-[#26241f]/[0.07]">
          {pets === null ? <div className="aspect-[3/5] w-full sm:aspect-[16/9]" /> : <iframe
            key={`${hour}-${pets}`}
            src={`/demo?n=${pets}&embed=1${h === null ? '' : `&h=${h}`}`}
            title="a demo garden"
            className="block aspect-[3/5] w-full sm:aspect-[16/9]"
          />}
        </div>
      </div>
    </section>
  )
}

const STEPS = ['run it once', 'open the link it prints', 'send friends your invite']

function Start() {
  return (
    <section id="start" className="mx-auto max-w-3xl scroll-mt-24 px-5 py-28 text-center sm:py-40">
      <div className="mx-auto mb-8 flex w-fit items-end gap-1" aria-hidden="true">
        <Sprite species="dango" color="sora" stage="baby" state="idle" size={56} animate />
        <Sprite species="mochi" color="sakura" stage="evolved" state="wave" size={88} animate />
        <Sprite species="taiyaki" color="yuzu" state="idle" size={68} animate />
      </div>
      <h2 className="font-display text-[2.2rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[3.4rem]">
        one command. <span className="text-[#a29d92]">no account.</span>
      </h2>
      <div className="mt-9 flex justify-center">
        <Command />
      </div>
      <ol className="mx-auto mt-10 flex max-w-xl flex-col items-center justify-center gap-3 text-[15px] text-[var(--muted)] sm:flex-row sm:gap-6">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-white text-[12px] font-bold text-[var(--ink)] shadow-[0_1px_2px_rgba(38,36,31,0.1)]">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
    </section>
  )
}

/** The front door: brand and a live pet up top, what it does, how it grows, a demo garden, privacy. */
export function Landing() {
  return (
    <div className="on-page min-h-[100dvh] overflow-x-clip">
      <Nav />
      <main>
        <Hero />
        <Cards />
        <Evolution />
        <Garden />
        <Privacy />
        <Start />
      </main>
      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-8 text-sm text-[var(--muted)] sm:px-8">
          <span className="flex items-center gap-2 font-display font-bold text-[var(--ink)]"><Logo size={13} />burrow</span>
          <span>MIT licensed</span>
          <Link href="/privacy" className="hover:text-[var(--ink)]">privacy</Link>
          <a href={REPO} className="hover:text-[var(--ink)]">GitHub</a>
        </div>
      </footer>
    </div>
  )
}
