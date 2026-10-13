'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { Bell, Hand, Pointer, Terminal, Users } from '@/components/icons'
import { Logo } from '@/components/Logo'
import { Sprite } from '@/components/Sprite'

function Card({ tone, title, body, children, wide = false }: { tone: 'sky' | 'light' | 'gold'; title: ReactNode; body: string; children: ReactNode; wide?: boolean }) {
  return (
    <article className={`card card-${tone} flex flex-col p-7 sm:p-10 ${wide ? 'lg:col-span-2' : ''}`}>
      <h3 className={`text-balance font-display ${wide ? '' : 'max-w-[22ch]'} text-[1.75rem] font-bold leading-[1.15] tracking-[-0.025em] sm:text-[2.1rem]`}>{title}</h3>
      <p className={`mt-3 max-w-[40ch] text-[16px] leading-relaxed sm:text-[17px] ${tone === 'sky' ? 'text-white/85' : 'text-[#26241f]/65'}`}>{body}</p>
      <div className="relative mt-8 flex flex-1 items-end justify-center">{children}</div>
    </article>
  )
}

function InPill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <span className="inpill">{icon}{children}</span>
}

/** A run's clock, ticking from 0:42. */
function useClock(from: number) {
  const [s, setS] = useState(from)
  useEffect(() => {
    const t = setInterval(() => setS((n) => (n >= from + 80 ? from : n + 1)), 1000)
    return () => clearInterval(t)
  }, [from])
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const TOOLS = [
  ['Read', 'src/auth/session.ts'],
  ['Edit', 'src/auth/session.ts', '+12 −3'],
  ['Bash', 'npm test'],
] as const

function Works() {
  const clock = useClock(42)
  return (
    <div className="flex w-full flex-col items-center">
      <p className="font-display text-[3.5rem] font-bold leading-none tracking-[-0.02em] text-white/90 tabular-nums">{clock}</p>
      <p className="mt-2 flex items-center gap-2 text-[14px] text-white/80"><span className="dot dot-live" aria-hidden="true" />Claude is working</p>
      <Sprite species="mochi" color="sakura" state="work" size={120} animate className="mt-4 drop-shadow-[0_14px_14px_rgba(20,30,80,0.25)]" />
      <ul className="glass mt-2 w-full max-w-sm space-y-2 p-4 font-mono text-[13px]">
        {TOOLS.map(([tool, arg, diff], i) => (
          <li key={i} className={`flex gap-3 ${i === TOOLS.length - 1 ? 'text-white' : 'text-white/55'}`}>
            <span className="w-10 font-bold">{tool}</span>
            <span className="truncate">{arg}</span>
            {diff && <span className="ml-auto text-white/70">{diff}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Waves() {
  return (
    <div className="flex w-full max-w-md flex-col items-stretch">
      <div className="mb-3 flex w-fit items-center gap-2 self-start rounded-t-xl rounded-b-md bg-white px-3 py-2 text-[13px] font-medium shadow-[0_1px_2px_rgba(38,36,31,0.08)]">
        <Logo size={10} blink={false} />
        kiwi needs you · burrow
        <Bell size={14} className="ml-1 text-[#d49a2e]" />
      </div>
      <div className="relative">
        <Sprite species="mochi" color="sakura" state="wave" size={96} animate className="absolute -top-[82px] right-8" />
        <div className="term p-5 font-mono text-[13px] leading-[1.75]">
          <p><span className="text-[#e0a43a]">●</span> Bash<span className="text-white/50">(npm test)</span></p>
          <p className="mt-2 text-white/90">Do you want to proceed?</p>
          <p className="text-[#9ec7ff]">❯ 1. Yes</p>
          <p className="text-white/50">&nbsp; 2. Yes, and don&apos;t ask again</p>
          <p className="text-white/50">&nbsp; 3. No</p>
        </div>
      </div>
    </div>
  )
}

const FRIENDS = [
  { name: 'jun', species: 'tofu', color: 'matcha', state: 'work', note: 'working' },
  { name: 'ada', species: 'dango', color: 'sora', state: 'wave', note: 'waiting 6m', alert: true },
  { name: 'mo', species: 'onigiri', color: 'rice', state: 'sleep', note: 'asleep' },
  { name: 'dora', species: 'dorayaki', color: 'kinako', state: 'eat', note: 'done' },
] as const

function Friends() {
  return (
    <div className="w-full">
      <div className="relative mx-auto flex max-w-3xl items-end justify-around px-2">
        {FRIENDS.map((f, i) => (
          <div key={f.name} className={`relative flex flex-col items-center ${i > 2 ? 'hidden sm:flex' : ''}`}>
            {'alert' in f && (
              <span className="float absolute -top-12 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold shadow-[0_10px_24px_-10px_rgba(38,36,31,0.4)]">
                <Pointer size={14} /> you poked ada
              </span>
            )}
            <Sprite species={f.species} color={f.color} state={f.state} size={96} animate className="!size-[72px] sm:!size-[96px]" />
            <span className={`mb-3 mt-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${'alert' in f ? 'bg-[#26241f] text-[#f7f4ec] shadow-[0_0_0_2px_rgba(240,198,78,0.9)]' : 'bg-white/70 text-[#26241f]'}`}>
              {f.name} <span className="font-medium opacity-70">{f.note}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="ground h-3 rounded-full opacity-60" aria-hidden="true" />
    </div>
  )
}

export function Cards() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-10 sm:px-8 sm:pt-20">
      <h2 className="max-w-4xl text-balance px-1 font-display text-[2.2rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[3.4rem]">
        what your pet does <span className="text-[#a29d92]">while Claude codes</span>
      </h2>
      <div className="mt-10 grid gap-4 sm:mt-14 lg:grid-cols-2 lg:gap-5">
        <Card tone="sky" title={<>it <InPill icon={<Terminal />}>works</InPill> while Claude runs</>} body="typing while Claude edits, eating when the task is done.">
          <Works />
        </Card>
        <Card tone="light" title={<>when Claude asks, it <InPill icon={<Hand />}>waves</InPill></>} body="the tab chimes and its title changes, so you're back in seconds.">
          <Waves />
        </Card>
        <Card tone="gold" title={<>your friends <InPill icon={<Users />}>live here</InPill> too</>} body="one garden for everyone. see who's stuck and poke them." wide>
          <Friends />
        </Card>
      </div>
    </section>
  )
}
