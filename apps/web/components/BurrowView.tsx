'use client'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { GARDEN_LAYOUTS, PET_COLORS, spotsFor, TIMING, type GardenGeometry, type GardenLayout, type Member, type PetState } from '@burrow/core'
import { Garden, Stone } from './Garden'
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

function ago(ms: number): string {
  const m = Math.round(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  return `${Math.round(m / 60)} h ago`
}

function useClockHour(): number {
  const [hour, setHour] = useState(() => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 })
  useEffect(() => {
    const t = setInterval(() => { const d = new Date(); setHour(d.getHours() + d.getMinutes() / 60) }, 60_000)
    return () => clearInterval(t)
  }, [])
  return hour
}

// Portrait screens get the tall garden. The server renders wide; the client corrects without a hydration mismatch.
const TALL = '(max-aspect-ratio: 4/5)'
function useLayout(): GardenLayout {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(TALL)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => (matchMedia(TALL).matches ? 'tall' : 'wide'),
    () => 'wide',
  )
}

export function BurrowView({ id }: { id: string }) {
  const { status, burrow, members, offset } = useBurrow(id)
  const states = usePetStates(members, offset)
  const hour = useClockHour()
  const sky = skyAt(hour)
  const seasonNow = season(new Date().getMonth())
  const leaf = LEAF[seasonNow]
  const layout = useLayout()
  const g = GARDEN_LAYOUTS[layout]
  const spots = spotsFor(members.length, layout)
  const placed = members.slice(0, spots.length).map((m, i) => ({ m, spot: spots[i]! }))

  // A background tab still answers "is it done, or waiting on me?"
  useEffect(() => {
    document.title = burrowTitle(members.map((m) => ({ name: m.name, state: states.get(m.petId)?.state ?? 'sleep' })))
  }, [members, states])

  // Every finished task sends one ripple across the pond, from the side the pet sits on.
  const now = Date.now() + offset
  const ripples = placed.flatMap(({ m, spot }) =>
    m.events.filter((e) => e.type === 'stop' && now - e.t < TIMING.eatMs).map((e) => ({ key: `${m.petId}-${e.t}`, x: spot.x })),
  )

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden" style={{ background: sky.top }}>
      <Garden g={g} sky={sky} leaf={leaf} fallen={seasonNow === 'autumn'} ripples={ripples}>
        {[...placed].sort((a, b) => a.spot.y - b.spot.y).map(({ m, spot }) => {
          const size = 200 * spot.scale
          const st = states.get(m.petId)?.state ?? 'sleep'
          return (
            <g key={m.petId}>
              <Stone x={spot.x} y={spot.y} scale={spot.scale} night={sky.night} />
              <Pet species={m.species} state={st} color={PET_COLORS[m.color]} x={spot.x - size / 2} y={spot.y - size + 14 * spot.scale} size={size} />
            </g>
          )
        })}
      </Garden>

      <header className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-5 py-4 sm:px-8" style={{ color: sky.ink }}>
        <span className="flex items-center gap-2 font-display text-xl font-bold">
          <svg width={26} height={26} viewBox="0 0 120 120" aria-hidden="true"><Pet species="mochi" state="idle" color={PET_COLORS.sakura} size={120} /></svg>
          burrow
        </span>
        {burrow && <span className="truncate text-sm opacity-80">{burrow.name}</span>}
        <span className="glass ml-auto rounded-full px-3 py-1 text-xs font-medium" role="status">
          {status === 'live' ? 'live' : status === 'not_found' ? 'not found' : status === 'reconnecting' ? 'reconnecting…' : 'connecting…'}
        </span>
      </header>

      <Tags g={g} placed={placed} states={states} />

      {status === 'not_found' && (
        <Notice title="this burrow doesn't exist." body="check the link for typos, or start your own garden:" command="npx burrow-pets init" />
      )}
      {status === 'live' && members.length === 0 && (
        <Notice title="nobody lives here yet." body="hatch the first pet from your terminal:" command="npx burrow-pets init" />
      )}

      <ul className="sr-only" aria-live="polite">
        {members.map((m) => {
          const r = states.get(m.petId)
          const st = r?.state ?? 'sleep'
          return (
            <li key={m.petId}>
              {m.name} is {VERB[st]}: {WHY[st]}{r?.lastEventAt ? `, last activity ${ago(Date.now() + offset - r.lastEventAt)}` : ''}.
            </li>
          )
        })}
      </ul>
    </main>
  )
}

function Tags({ g, placed, states }: {
  g: GardenGeometry
  placed: Array<{ m: Member; spot: { x: number; y: number; scale: number } }>; states: ReturnType<typeof usePetStates> }) {
  // Tags are HTML so they stay crisp and selectable; positioned in % of the same viewBox the SVG slices.
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2 min-h-full min-w-full -translate-x-1/2 -translate-y-1/2" style={{ aspectRatio: `${g.w} / ${g.h}` }}>
        {placed.map(({ m, spot }) => {
          const st = states.get(m.petId)?.state ?? 'sleep'
          return (
            <span
              key={m.petId}
              className={`tag absolute -translate-x-1/2 ${st === 'wave' ? 'tag-alert' : ''}`}
              style={{ left: `${(spot.x / g.w) * 100}%`, top: `${((spot.y + 34 * spot.scale) / g.h) * 100}%` }}
            >
              {m.name}
              <i>{VERB[st]}</i>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function Notice({ title, body, command }: { title: string; body: string; command?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="glass absolute inset-x-4 bottom-8 z-10 mx-auto max-w-md rounded-2xl p-5 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="mt-1 text-sm opacity-80">{body}</p>
      {command && (
        <div className="mt-3 inline-flex items-center gap-3 rounded-full bg-black/5 py-1.5 pl-4 pr-1.5 font-mono text-sm dark:bg-white/10">
          {command}
          <button
            type="button"
            className="rounded-full bg-[var(--sumi)] px-3 py-1 font-display text-xs font-bold text-[var(--washi)] active:scale-[0.97]"
            onClick={() => navigator.clipboard?.writeText(command).then(() => setCopied(true), () => {})}
          >
            {copied ? 'copied' : 'copy'}
          </button>
        </div>
      )}
    </div>
  )
}
