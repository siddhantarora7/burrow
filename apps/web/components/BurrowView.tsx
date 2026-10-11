'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { PixelBurrow, spriteCanvas, VERB } from './PixelBurrow'
import { paletteAt, phaseAt } from '@/lib/pixel/palette'
import { useBurrow } from '@/lib/useBurrow'
import type { BurrowState } from '@/lib/burrowState'
import { usePetStates } from '@/lib/usePetStates'
import { burrowTitle } from '@/lib/status'

const COMMAND = 'npx burrow-pets init'

// The visitor's own clock drives the light. The server cannot know it, so it renders the
// chrome only (null) instead of guessing a time of day.
function subscribeClock(cb: () => void) {
  const t = setInterval(cb, 15_000)
  return () => clearInterval(t)
}
const clockKey = () => {
  // ?h=21.5 previews a time of day (screenshots, the demo video); otherwise the visitor's clock.
  const preview = Number(new URLSearchParams(location.search).get('h'))
  if (preview > 0 && preview < 24) return Math.round(preview * 60)
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}
function useHour(): number | null {
  const minutes = useSyncExternalStore(subscribeClock, clockKey, () => null)
  return minutes === null ? null : minutes / 60
}

/** The header mark: a mochi sprite, drawn once. */
function Mark() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, 32, 32)
    ctx.drawImage(spriteCanvas('mochi', 'idle', 0, false), 0, 0)
  }, [])
  return <canvas ref={ref} width={32} height={32} className="h-8 w-8 [image-rendering:pixelated]" aria-hidden="true" />
}

export function BurrowView({ id }: { id: string }) {
  return <BurrowScreen {...useBurrow(id)} />
}

/** The garden page for any source of members: the live WebSocket, or the synthetic demo. */
export function BurrowScreen({ status, burrow, members, offset, label }: BurrowState & { label?: string }) {
  const states = usePetStates(members, offset)
  const hour = useHour()

  // A background tab still answers "is it done, or waiting on me?"
  useEffect(() => {
    document.title = burrowTitle(members.map((m) => ({ name: m.name, state: states.get(m.petId)?.state ?? 'sleep' })))
  }, [members, states])

  const night = hour !== null && phaseAt(hour).night
  const statusText = status === 'live' ? 'live' : status === 'not_found' ? 'not found' : status === 'reconnecting' ? 'reconnecting…' : 'connecting…'

  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden" style={{ background: hour === null ? 'var(--washi)' : paletteAt(hour).gravel }}>
      <header className="fixed inset-x-0 top-0 z-20 flex items-center gap-2 px-3 py-3 sm:px-6">
        <span className={`chip ${night ? 'chip-night' : ''} flex items-center gap-1.5 rounded-full py-0.5 pl-1.5 pr-4 font-display text-lg font-bold`}>
          <Mark />
          burrow
          {(label ?? burrow?.name) && <span className="ml-1 hidden text-sm font-medium opacity-70 sm:inline">{label ?? burrow?.name}</span>}
        </span>
        <nav className={`chip ${night ? 'chip-night' : ''} ml-auto flex items-center gap-3 rounded-full py-1 pl-3 pr-1 text-xs font-medium`}>
          <Link href="/privacy" className="underline-offset-4 hover:underline">privacy</Link>
          <span role="status" className="chip-solid rounded-full px-2.5 py-1">{statusText}</span>
        </nav>
      </header>

      {hour !== null && <PixelBurrow members={members} states={states} offset={offset} hour={hour} />}

      {status === 'not_found' ? (
        <Notice night={night} title="this burrow doesn't exist." body="check the link for typos, or start your own garden:" />
      ) : status === 'live' && members.length === 0 ? (
        <Notice night={night} title="nobody lives here yet." body="hatch the first pet from your terminal:" />
      ) : (
        <CommandPill night={night} />
      )}

      <ul className="sr-only">
        {members.map((m) => {
          const r = states.get(m.petId)
          return <li key={m.petId}>{m.name} is {r?.quiet ? 'quiet' : VERB[r?.state ?? 'sleep']}.</li>
        })}
      </ul>
    </main>
  )
}

function CopyButton() {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="chip-solid rounded-full px-3 py-1 font-display text-xs font-bold transition-transform active:scale-[0.97]"
      onClick={() => navigator.clipboard?.writeText(COMMAND).then(() => setCopied(true), () => {})}
    >
      {copied ? 'copied' : 'copy'}
    </button>
  )
}

function CommandPill({ night }: { night: boolean }) {
  return (
    <div className={`chip ${night ? 'chip-night' : ''} fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full py-1.5 pl-4 pr-1.5 text-sm sm:left-6 sm:translate-x-0`}>
      <span className="hidden font-display font-bold sm:inline">get a pet</span>
      <code className="font-mono text-[13px]">{COMMAND}</code>
      <CopyButton />
    </div>
  )
}

function Notice({ title, body, night }: { title: string; body: string; night: boolean }) {
  return (
    <div className={`chip ${night ? 'chip-night' : ''} fixed inset-x-4 bottom-8 z-20 mx-auto max-w-md rounded-2xl p-5 text-center`}>
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="mt-1 text-sm opacity-80">{body}</p>
      <div className="mt-3 inline-flex items-center gap-3 whitespace-nowrap rounded-full bg-black/5 py-1.5 pl-4 pr-1.5 font-mono text-sm">
        {COMMAND}
        <CopyButton />
      </div>
    </div>
  )
}
