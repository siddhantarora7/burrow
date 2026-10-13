'use client'
import { useEffect, useState } from 'react'
import type { PetState } from '@burrow/core'
import { Bell, Check } from '@/components/icons'
import { Sprite } from '@/components/Sprite'
import { Command, Note, Wordmark } from './bits'

/** One Claude Code session, looped: what the agent is doing, and what the pet does about it. */
const SCRIPT: Array<{ state: PetState; ms: number; text: string; alert?: boolean; done?: boolean }> = [
  { state: 'work', ms: 4200, text: 'Claude is editing auth.ts' },
  { state: 'wave', ms: 5000, text: 'Claude is waiting on you', alert: true },
  { state: 'cheer', ms: 1500, text: 'you answered', done: true },
  { state: 'work', ms: 3400, text: 'Claude is running the tests' },
  { state: 'eat', ms: 3800, text: 'done in 4m 12s', done: true },
]

function useLoop() {
  const [i, setI] = useState(0)
  const [waited, setWaited] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setI((n) => (n + 1) % SCRIPT.length), SCRIPT[i]!.ms)
    return () => clearTimeout(t)
  }, [i])
  useEffect(() => {
    setWaited(0)
    if (!SCRIPT[i]!.alert) return
    const t = setInterval(() => setWaited((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [i])
  return { step: SCRIPT[i]!, waited }
}

/** The pet, big, acting out the loop; a click boops it. */
function Stage() {
  const { step, waited } = useLoop()
  const [booped, setBooped] = useState(false)
  useEffect(() => {
    if (!booped) return
    const t = setTimeout(() => setBooped(false), 1300)
    return () => clearTimeout(t)
  }, [booped])
  const state = booped ? 'cheer' : step.state

  return (
    <div className="relative flex flex-col items-center">
      <button type="button" onClick={() => setBooped(true)} aria-label="boop the pet" className="float relative rounded-[40px]">
        <Sprite species="mochi" color="sakura" state={state} size={256} animate className="!size-[200px] sm:!size-[256px]" />
      </button>
      <span className="-mt-7 h-4 w-40 rounded-[50%] bg-[#26241f]/10 blur-[2px] sm:-mt-9 sm:w-48" aria-hidden="true" />
      <p
        className={`mt-6 flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors duration-300 ${step.alert ? 'bg-[#26241f] text-[#f7f4ec] shadow-[0_0_0_3px_rgba(240,198,78,0.85),0_10px_24px_-10px_rgba(38,36,31,0.5)]' : 'bg-white text-[#26241f] shadow-[0_1px_2px_rgba(38,36,31,0.06),0_10px_24px_-12px_rgba(38,36,31,0.25)]'}`}
      >
        {step.alert ? <Bell className="text-[#f0c64e]" /> : step.done ? <Check className="text-[#3fae7a]" /> : <span className="dot dot-live" aria-hidden="true" />}
        <span className="lbl tabular-nums">
          {step.text}
          {step.alert && <span className="opacity-60"> · 0:{String(waited).padStart(2, '0')}</span>}
        </span>
      </p>
      <span className="absolute -left-20 top-[62%] hidden -rotate-6 sm:block"><Note dir="up-right">boop it</Note></span>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[100svh] max-w-[1320px] flex-col items-center justify-center gap-8 px-5 pb-16 pt-28 sm:gap-10 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:gap-16 xl:px-10 xl:pt-20">
      <h1 className="xl:justify-self-end">
        <span className="xl:hidden"><Wordmark size={52} /></span>
        <span className="hidden xl:block"><Wordmark size={84} /></span>
      </h1>
      <Stage />
      <div className="flex max-w-md flex-col items-center text-center xl:items-start xl:justify-self-start xl:text-left">
        <p className="font-display text-[2.6rem] font-bold leading-[1.04] tracking-[-0.035em] sm:text-[3.4rem]">
          your agent waits.
          <br />
          <span className="text-[#a29d92]">your pet waves.</span>
        </p>
        <p className="mt-5 text-[17px] leading-relaxed text-[var(--muted)]">a pixel pet for Claude Code, in a garden you share with friends.</p>
        <div className="mt-8">
          <Command />
        </div>
        <p className="mt-4 text-[13px] text-[var(--muted)]">free · open source · no account</p>
      </div>
    </section>
  )
}
