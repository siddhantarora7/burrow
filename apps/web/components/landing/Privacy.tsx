import Link from 'next/link'
import type { PetColor, PetState, Species } from '@burrow/core'
import { Sprite } from '@/components/Sprite'
import { REPO } from './bits'

const POINTS: Array<{ species: Species; color: PetColor; state: PetState; title: string; body: React.ReactNode }> = [
  { species: 'mochi', color: 'sakura', state: 'idle', title: 'four fields. that’s all.', body: 'a type, a time, a salted session id and a version. the server turns away anything else.' },
  { species: 'onigiri', color: 'rice', state: 'sleep', title: 'your code stays home.', body: 'no prompts, replies, file names or paths ever leave your machine.' },
  { species: 'tofu', color: 'matcha', state: 'cheer', title: 'no account.', body: <>your pet lives in <code className="font-mono text-[14px]">~/.burrow</code> on your machine. no email, no password.</> },
  { species: 'dango', color: 'sora', state: 'work', title: 'read every line.', body: <>MIT licensed. the hook and the server are <a href={REPO} className="underline underline-offset-4">on GitHub</a>.</> },
]

export function Privacy() {
  return (
    <section id="privacy" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-28 sm:px-8 sm:pt-40">
      <p className="hand text-center text-[22px] text-[var(--muted)]">privacy, in plain words</p>
      <h2 className="mt-2 text-balance text-center font-display text-[2.2rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[3.4rem]">it knows when. never what.</h2>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {POINTS.map((x) => (
          <div key={x.title} className="card-white flex gap-5 p-6 sm:p-8">
            <Sprite species={x.species} color={x.color} state={x.state} size={80} animate className="-my-3 shrink-0" />
            <div>
              <h3 className="font-display text-[1.35rem] font-bold tracking-[-0.02em]">{x.title}</h3>
              <p className="mt-1.5 text-[16px] leading-relaxed text-[var(--muted)]">{x.body}</p>
            </div>
          </div>
        ))}
        <div className="card-white grid gap-8 p-6 sm:col-span-2 sm:p-10 lg:grid-cols-[1fr_1.3fr]">
          <div className="flex gap-5">
            <Sprite species="taiyaki" color="yuzu" state="wave" size={80} animate className="-my-3 shrink-0" />
            <div>
              <p className="hand text-[20px] text-[var(--muted)]">the whole message</p>
              <h3 className="font-display text-[1.6rem] font-bold leading-tight tracking-[-0.02em]">what leaves your laptop.</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-[var(--muted)]">
                when Claude asks to run a command, this is everything burrow hears about it. <Link href="/privacy" className="underline underline-offset-4">the details</Link>
              </p>
            </div>
          </div>
          <div className="min-w-0">
            <p className="hand text-[19px] text-[var(--muted)]">Claude sees</p>
            <div className="mt-1 rounded-2xl bg-[#f5f2ea] p-4 font-mono text-[13px] leading-relaxed">
              <p><span className="text-[#c4841a]">●</span> Bash(npm test -- auth)</p>
              <p className="text-[var(--muted)]">“run the auth tests before I push”</p>
            </div>
            <svg viewBox="0 0 40 40" className="my-1 ml-8 h-10 w-10 text-[#8a857b]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 4c-6 10-4 22 6 31" />
              <path d="M11 30l9 5 2-10" />
            </svg>
            <p className="hand text-[19px] text-[var(--muted)]">burrow gets</p>
            <div className="relative mt-1 overflow-x-auto rounded-2xl bg-[#f5f2ea] p-4 font-mono text-[13px] leading-relaxed">
              {'{ "v": 1, "type": "needs_input", "at": 1791234567890, "session": "3f9a1c0e7b2d" }'}
            </div>
            <p className="hand mt-3 text-[22px]">
              that&apos;s{' '}
              <span className="relative inline-block px-1">
                it
                <svg viewBox="0 0 60 30" preserveAspectRatio="none" className="absolute left-1/2 top-1/2 h-[40px] w-[62px] -translate-x-1/2 -translate-y-1/2 text-[#d9534f]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                  <path d="M10 17c2-9 18-13 32-11 12 2 16 10 8 16-9 6-30 6-40 1-4-2-5-6-2-9" vectorEffect="non-scaling-stroke" />
                </svg>
              </span>.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
