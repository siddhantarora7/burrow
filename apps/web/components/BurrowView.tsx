'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { PixelBurrow, spriteCanvas } from './PixelBurrow'
import { paletteAt, phaseAt } from '@/lib/pixel/palette'
import { useBurrow } from '@/lib/useBurrow'
import type { BurrowState } from '@/lib/burrowState'
import { usePetStates } from '@/lib/usePetStates'
import { useAlerts } from '@/lib/useAlerts'
import { burrowTitle, VERB } from '@/lib/status'
import { INIT, inviteCommand } from '@/lib/commands'
import { Bell, BellOff, BookOpen, Check, Copy, ShieldCheck, Terminal, Trophy, UserPlus, VolumeOff } from './icons'
import { CarePill } from './CarePill'
import { CatalogPanel, RanksPanel, type PanelName } from './Panels'
import type { CareAction } from '@burrow/core'

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
export function Mark() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, 32, 32)
    ctx.drawImage(spriteCanvas('mochi', 'sakura', 'idle', 0, false), 0, 0)
  }, [])
  return <canvas ref={ref} width={32} height={32} className="h-7 w-7 [image-rendering:pixelated]" aria-hidden="true" />
}

export function BurrowView({ id }: { id: string }) {
  return <BurrowScreen {...useBurrow(id)} invite={id} />
}

type ScreenProps = BurrowState & {
  poke?: (to: string) => void
  care?: (action: CareAction) => void
  /** Header text beside the wordmark; defaults to the burrow's name. */
  label?: string
  /** Replaces the connection status, e.g. "demo". */
  statusLabel?: string
  /** This garden's id: the bottom pill then invites a friend into it. */
  invite?: string
  /** Inside the landing page's frame: the garden alone, no chrome. */
  embed?: boolean
}

const ALERT_ICON = { 'alerts on': Bell, 'allow notifications': Bell, 'chime only': Bell, 'alerts off': BellOff, 'click for sound': VolumeOff } as const

/** The garden page for any source of members: the live WebSocket, or the synthetic demo. */
export function BurrowScreen({ status, burrow, members, offset, me, pokes, poke, care, catalog, cares, label, statusLabel, invite, embed = false }: ScreenProps) {
  const states = usePetStates(members, offset)
  const [panel, setPanel] = useState<PanelName | null>(null)
  const mine = me ? members.find((m) => m.petId === me) : undefined
  const showCare = !embed && !!mine && !!care
  const alerts = useAlerts({ me, members, states, pokes })
  const hour = useHour()

  // A background tab still answers "is it done, or waiting on me?"
  useEffect(() => {
    if (!embed) document.title = burrowTitle(members.map((m) => ({ name: m.name, state: states.get(m.petId)?.state ?? 'sleep' })))
  }, [members, states, embed])

  const night = hour !== null && phaseAt(hour).night
  const skin = `chip ${night ? 'chip-night' : ''}`
  const statusText = statusLabel ?? (status === 'live' ? 'live' : status === 'not_found' ? 'not found' : status === 'reconnecting' ? 'reconnecting…' : 'connecting…')
  const dot = statusLabel ? 'dot-demo' : status === 'live' ? 'dot-live' : status === 'not_found' ? 'dot-gone' : 'dot-wait'
  const AlertIcon = ALERT_ICON[alerts.label]

  return (
    <main className="garden relative min-h-[100dvh] w-full overflow-x-hidden" style={{ background: hour === null ? 'var(--paper)' : paletteAt(hour).gravel }}>
      {!embed && (
        <header className="fixed inset-x-0 top-0 z-20 flex items-center gap-2 px-3 py-3 sm:px-6 sm:py-5">
          <Link href="/" aria-label="burrow home" className={`${skin} pill gap-2 px-1.5 min-[420px]:pl-2 min-[420px]:pr-4`}>
            <Mark />
            <span className="lbl hidden text-base font-bold min-[420px]:block">burrow</span>
            {(label ?? burrow?.name) && <span className="lbl hidden border-l border-current/20 pl-2.5 opacity-70 sm:block">{label ?? burrow?.name}</span>}
          </Link>
          <nav className={`${skin} pill ml-auto gap-0.5 px-1`}>
            <button type="button" className="pill-btn" onClick={() => setPanel('catalog')} aria-label="catalog">
              <BookOpen />
              <span className="lbl hidden md:block">catalog</span>
            </button>
            <button type="button" className="pill-btn" onClick={() => setPanel('ranks')} aria-label="ranks">
              <Trophy />
              <span className="lbl hidden md:block">ranks</span>
            </button>
            {me && (
              <button type="button" onClick={alerts.press} className="pill-btn" title="alerts when your agent waits on you, or a friend pokes you" aria-label={alerts.label}>
                <AlertIcon />
                <span className="lbl hidden sm:block">{alerts.label}</span>
              </button>
            )}
            <Link href="/privacy" className="pill-btn" aria-label="privacy">
              <ShieldCheck />
              <span className="lbl hidden sm:block">privacy</span>
            </Link>
            <span role="status" className="flex h-8 items-center gap-2 pl-2.5 pr-3.5">
              <span className={`dot ${dot}`} aria-hidden="true" />
              <span className="lbl">{statusText}</span>
            </span>
          </nav>
        </header>
      )}

      {hour !== null && <PixelBurrow members={members} states={states} offset={offset} hour={hour} me={me} pokes={pokes} onPoke={poke} showHint={!embed} cares={cares} careShown={showCare} />}

      {showCare && <CarePill member={mine!} night={night} onCare={care!} />}
      {panel === 'catalog' && <CatalogPanel catalog={catalog} members={members} night={night} onClose={() => setPanel(null)} />}
      {panel === 'ranks' && <RanksPanel members={members} me={me} night={night} onClose={() => setPanel(null)} />}

      {embed ? null : status === 'not_found' ? (
        <Notice night={night} title="this burrow doesn't exist." body="check the link for typos, or start your own garden:" command={INIT} />
      ) : status === 'live' && members.length === 0 ? (
        <Notice night={night} title="nobody lives here yet." body="hatch the first pet from your terminal:" command={invite ? inviteCommand(location.origin, invite) : INIT} />
      ) : invite ? (
        <InvitePill night={night} burrowId={invite} />
      ) : (
        <CommandPill night={night} />
      )}

      <ul className="sr-only">
        {members.map((m) => {
          const r = states.get(m.petId)
          return <li key={m.petId}>{m.name}: {r?.quiet ? 'quiet' : VERB[r?.state ?? 'sleep']}.</li>
        })}
      </ul>
    </main>
  )
}

/** A copy button that says what it copied for two seconds. */
export function CopyButton({ text, label = 'copy', className = '' }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <button
      type="button"
      className={`pill-btn chip-solid font-bold ${className}`}
      onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {})}
    >
      {copied ? <Check /> : <Copy />}
      <span className="lbl" aria-live="polite">{copied ? 'copied' : label}</span>
    </button>
  )
}

const bottomPill = 'fixed bottom-4 left-1/2 z-20 -translate-x-1/2 sm:bottom-6 sm:left-6 sm:translate-x-0'

function CommandPill({ night }: { night: boolean }) {
  return (
    <div className={`chip ${night ? 'chip-night' : ''} pill ${bottomPill} gap-3 pr-1`}>
      <Terminal className="opacity-60" />
      <code className="lbl font-mono text-[13px]">{INIT}</code>
      <CopyButton text={INIT} />
    </div>
  )
}

/** Your garden grows by invitation: the command a friend runs to move their new pet in here. */
function InvitePill({ night, burrowId }: { night: boolean; burrowId: string }) {
  const [command, setCommand] = useState<string | null>(null)
  useEffect(() => setCommand(inviteCommand(location.origin, burrowId)), [burrowId])
  if (!command) return null
  return (
    <div className={`chip ${night ? 'chip-night' : ''} pill ${bottomPill} gap-3 pr-1`} title={command}>
      <UserPlus className="opacity-70" />
      <span className="lbl font-bold">invite a friend</span>
      <CopyButton text={command} label="copy command" />
    </div>
  )
}

function Notice({ title, body, night, command }: { title: string; body: string; night: boolean; command: string }) {
  return (
    <div className={`chip ${night ? 'chip-night' : ''} fixed inset-x-4 bottom-8 z-20 mx-auto max-w-md rounded-2xl p-5 text-center`}>
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="mt-1 text-sm opacity-80">{body}</p>
      <div className="mt-3 flex items-center gap-3 rounded-full bg-current/5 py-1 pl-4 pr-1">
        <code className="min-w-0 flex-1 truncate text-left font-mono text-[13px]">{command}</code>
        <CopyButton text={command} />
      </div>
    </div>
  )
}
