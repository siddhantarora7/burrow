'use client'
import Link from 'next/link'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { gardenFor, PET_COLORS, TIMING, type GardenGeometry, type GardenLayout, type Member, type PetState, type Spot } from '@burrow/core'
import { Garden, Ripples, Stone } from './Garden'
import { Pet } from './Pet'
import { season, skyAt } from '@/lib/sky'
import { useBurrow } from '@/lib/useBurrow'
import { usePetStates } from '@/lib/usePetStates'
import { burrowTitle } from '@/lib/status'

const LEAF = { spring: '#E9B7C4', summer: '#7FA05A', autumn: '#C9573B', winter: '#A7AE9F' } as const
const VERB: Record<PetState, string> = {
  idle: 'hanging out', eat: 'eating', wave: 'needs you', work: 'working', sleep: 'asleep', cheer: 'cheering',
}
const WHY: Record<PetState, string> = {
  idle: 'agent is quiet', eat: 'agent finished a task', wave: 'agent is waiting for input',
  work: 'agent is on a long run', sleep: `no activity for ${TIMING.idleMs / 60_000} minutes`, cheer: 'a friend just shipped',
}
const COMMAND = 'npx burrow-pets init'
const GARDEN_WIDTH: Record<GardenLayout, number> = { wide: 1600, tall: 800 }

// The visitor's own clock drives the sky. The server cannot know it, so it renders the
// chrome only (null) instead of guessing a time of day and flashing the wrong sky.
function subscribeClock(cb: () => void) {
  const t = setInterval(cb, 15_000)
  return () => clearInterval(t)
}
const clockKey = () => {
  const d = new Date()
  return `${d.getMonth()}:${d.getHours() * 60 + d.getMinutes()}`
}
function useClock(): { hour: number; month: number } | null {
  const key = useSyncExternalStore(subscribeClock, clockKey, () => null)
  if (key === null) return null
  const [month, minutes] = key.split(':').map(Number)
  return { hour: minutes! / 60, month: month! }
}

// Portrait screens get the tall garden.
const TALL = '(max-aspect-ratio: 4/5)'
function subscribeLayout(cb: () => void) {
  const mq = matchMedia(TALL)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
function useLayout(): GardenLayout {
  return useSyncExternalStore(subscribeLayout, () => (matchMedia(TALL).matches ? 'tall' : 'wide'), () => 'wide')
}

// Viewport proportions, so the garden is drawn to fill the screen rather than cropped.
function subscribeResize(cb: () => void) {
  addEventListener('resize', cb)
  return () => removeEventListener('resize', cb)
}
function useViewportRatio(): number | null {
  return useSyncExternalStore(subscribeResize, () => innerHeight / innerWidth, () => null)
}

/** Percent box for something drawn at viewBox coordinates, inside the overlay that mirrors the SVG's slice. */
function box(g: GardenGeometry, x: number, y: number, w: number, h: number) {
  return { left: `${(x / g.w) * 100}%`, top: `${(y / g.h) * 100}%`, width: `${(w / g.w) * 100}%`, height: `${(h / g.h) * 100}%` }
}

export function BurrowView({ id }: { id: string }) {
  const { status, burrow, members, offset } = useBurrow(id)
  const states = usePetStates(members, offset)
  const clock = useClock()
  const layout = useLayout()
  const ratio = useViewportRatio()

  // A background tab still answers "is it done, or waiting on me?"
  useEffect(() => {
    document.title = burrowTitle(members.map((m) => ({ name: m.name, state: states.get(m.petId)?.state ?? 'sleep' })))
  }, [members, states])

  const statusText = status === 'live' ? 'live' : status === 'not_found' ? 'not found' : status === 'reconnecting' ? 'reconnecting…' : 'connecting…'
  const header = (night: boolean) => (
    <header className={`absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-4 py-3 sm:px-8 sm:py-4 ${night ? 'text-[#eef0f8]' : 'text-[#1e2433]'}`}>
      <span className="flex items-center gap-2 font-display text-xl font-bold">
        <svg width={26} height={26} viewBox="0 0 120 120" aria-hidden="true">
          <Pet species="mochi" state="idle" color={PET_COLORS.sakura} size={120} />
        </svg>
        burrow
      </span>
      {burrow && <span className="hidden truncate text-sm opacity-80 sm:inline">{burrow.name}</span>}
      <nav className={`chip ${night ? 'chip-night' : ''} ml-auto flex items-center gap-3 rounded-full py-1 pl-3 pr-1 text-xs font-medium`}>
        <Link href="/privacy" className="underline-offset-4 hover:underline">privacy</Link>
        <span role="status" className="chip-solid rounded-full px-2.5 py-1">{statusText}</span>
      </nav>
    </header>
  )

  if (clock === null || ratio === null) {
    return <main className="relative h-[100dvh] w-full overflow-hidden bg-[var(--washi)]">{header(false)}</main>
  }

  const sky = skyAt(clock.hour)
  const autumn = season(clock.month) === 'autumn'
  const g = gardenFor(members.length, layout, GARDEN_WIDTH[layout] * ratio)
  const placed = members.slice(0, g.spots.length).map((m, i) => ({ m, spot: g.spots[i]! }))
  const shadowDx = layout === 'wide' ? 18 : 14

  // Every finished task sends one ripple across the pond, from the side the pet sits on.
  const now = Date.now() + offset
  const ripples = placed.flatMap(({ m, spot }) =>
    m.events.filter((e) => e.type === 'stop' && now - e.t < TIMING.eatMs).map((e) => ({ key: `${m.petId}-${e.t}`, x: spot.x })),
  )

  return (
    <main className="relative w-full overflow-x-hidden" style={{ background: sky.top }}>
      {header(sky.night)}
      {/* The stage keeps the garden's aspect ratio and grows taller (and scrolls) as members join. */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${g.w} / ${g.h}`, minHeight: '100dvh' }}>
        <Garden g={g} sky={sky} leaf={LEAF[season(clock.month)]} fallen={autumn}>
          {placed.map(({ spot }, i) => <Stone key={i} {...spot} night={sky.night} shadowDx={shadowDx} />)}
        </Garden>

        {/* Mirrors the SVG's xMidYMid slice, so percentages of the viewBox land on the same pixels. */}
        <div className="absolute left-1/2 top-1/2 min-h-full min-w-full -translate-x-1/2 -translate-y-1/2" style={{ aspectRatio: `${g.w} / ${g.h}` }} aria-hidden="true">
          <Ripples g={g} ripples={ripples} />
          {[...placed].sort((a, b) => a.spot.y - b.spot.y).map(({ m, spot }) => (
            <PetOnStone key={m.petId} g={g} m={m} spot={spot} state={states.get(m.petId)?.state ?? 'sleep'} night={sky.night} />
          ))}
        </div>
      </div>

      {status === 'not_found' ? (
        <Notice night={sky.night} title="this burrow doesn't exist." body="check the link for typos, or start your own garden:" />
      ) : status === 'live' && members.length === 0 ? (
        <Notice night={sky.night} title="nobody lives here yet." body="hatch the first pet from your terminal:" />
      ) : (
        <CommandPill night={sky.night} />
      )}

      <ul className="sr-only">
        {members.map((m) => {
          const r = states.get(m.petId)
          const st = r?.state ?? 'sleep'
          return (
            <li key={m.petId}>
              {m.name} is {VERB[st]}: {WHY[st]}.
            </li>
          )
        })}
      </ul>
    </main>
  )
}

function PetOnStone({ g, m, spot, state, night }: { g: GardenGeometry; m: Member; spot: Spot; state: PetState; night: boolean }) {
  const size = 200 * spot.scale
  return (
    <>
      <div className="absolute" style={box(g, spot.x - size / 2, spot.y - size + 14 * spot.scale, size, size)}>
        <Pet species={m.species} state={state} color={PET_COLORS[m.color]} size="100%" />
      </div>
      <span
        className={`tag absolute -translate-x-1/2 ${night ? 'tag-night' : ''} ${state === 'wave' ? 'tag-alert' : ''}`}
        style={{ left: `${(spot.x / g.w) * 100}%`, top: `${((spot.y + 40 * spot.scale) / g.h) * 100}%` }}
      >
        {m.name}
        <i>{VERB[state]}</i>
      </span>
    </>
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
    <div className={`chip ${night ? 'chip-night' : ''} fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full py-1.5 pl-4 pr-1.5 text-sm sm:left-8 sm:translate-x-0`}>
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
