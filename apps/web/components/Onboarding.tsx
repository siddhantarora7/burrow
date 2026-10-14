'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cleanName, growthOf, stageOf, type Member } from '@burrow/core'
import { inviteCommand } from '@/lib/commands'
import { toneOf } from '@/lib/pixel/sprites'
import { CopyButton } from './CopyButton'
import { ArrowRight, Bell, BellOff, Check, Close, Terminal, UserPlus, VolumeOff } from './icons'
import { Sprite } from './Sprite'

const ALERT_ICON = { 'alerts on': Bell, 'allow notifications': Bell, 'chime only': Bell, 'alerts off': BellOff, 'click for sound': VolumeOff } as const

/** What only the terminal can do: these change files on the owner's own computer. */
const TERMINAL = [
  { cmd: 'npx burrow-pets statusline on', what: "your pet and friends in Claude Code's status line" },
  { cmd: 'npx burrow-pets usage on', what: 'share token and cost totals with this garden (optional)' },
  { cmd: 'npx burrow-pets stats', what: "the garden's day as a table" },
]

function Row({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 rounded-full bg-current/[0.06] py-1 pl-4 pr-1">{children}</div>
}

/**
 * The first visit of a signed-in owner (and the "setup" button any time after): meet your pet and name it,
 * turn alerts on, invite friends, and the few things only the terminal can do.
 */
export function Onboarding({ member, night, invite, alerts, onRename, onDone }: {
  member: Member
  night: boolean
  invite?: string
  alerts: { label: keyof typeof ALERT_ICON; press: () => void }
  onRename: (name: string) => void
  onDone: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState(0)
  const [name, setName] = useState(member.name)
  const [command, setCommand] = useState<string | null>(null)
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal()
  }, [])
  useEffect(() => setCommand(invite ? inviteCommand(location.origin, invite) : null), [invite])

  const clean = cleanName(name)
  const AlertIcon = ALERT_ICON[alerts.label]
  const steps: Array<{ title: string; body: ReactNode }> = [
    {
      title: `meet ${member.name}`,
      body: (
        <>
          <div className="flex items-center gap-4">
            <Sprite species={member.species} color={toneOf(member.species, member.color)} stage={stageOf(growthOf(member).xp)} state="cheer" size={72} animate className="shrink-0" />
            <p className="font-sans text-[14px] leading-relaxed opacity-80">it works while Claude runs, eats when a task is done, and waves the moment Claude needs you.</p>
          </div>
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (clean && clean !== member.name) onRename(clean)
            }}
          >
            <label htmlFor="pet-name" className="font-sans text-[13px] opacity-70">its name, in every garden it lives in</label>
            <Row>
              <input id="pet-name" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 bg-transparent font-sans text-[15px] font-medium outline-none" aria-invalid={!clean} />
              <button type="submit" className="pill-btn chip-solid font-bold" disabled={!clean || clean === member.name}>
                {clean === member.name ? <Check /> : null}
                <span className="lbl">{clean === member.name ? 'saved' : 'rename'}</span>
              </button>
            </Row>
            {!clean && <p className="mt-1.5 font-sans text-[12px] opacity-70">1-16 letters, digits, spaces, - or _</p>}
          </form>
        </>
      ),
    },
    {
      title: 'keep this tab open',
      body: (
        <>
          <p className="font-sans text-[14px] leading-relaxed opacity-80">the tab chimes when your agent waits on you, its title changes, and a notification reaches you in other windows. friends can poke you too.</p>
          <button type="button" onClick={alerts.press} className="pill mt-4 bg-current/[0.06] font-bold">
            <AlertIcon />
            <span className="lbl">{alerts.label}</span>
          </button>
        </>
      ),
    },
    {
      title: 'invite friends',
      body: (
        <>
          <p className="font-sans text-[14px] leading-relaxed opacity-80">send them this. their new pet moves straight into this garden, and you can see whose agent is stuck.</p>
          {command && (
            <div className="mt-4">
              <Row>
                <UserPlus className="shrink-0 opacity-60" />
                <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{command}</code>
                <CopyButton text={command} />
              </Row>
            </div>
          )}
        </>
      ),
    },
    {
      title: 'from your terminal',
      body: (
        <>
          <p className="font-sans text-[14px] leading-relaxed opacity-80">a few things change files on your computer, so they run there:</p>
          <ul className="mt-4 flex flex-col gap-3">
            {TERMINAL.map((t) => (
              <li key={t.cmd}>
                <Row>
                  <Terminal className="shrink-0 opacity-60" />
                  <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{t.cmd}</code>
                  <CopyButton text={t.cmd} />
                </Row>
                <p className="mt-1 pl-4 font-sans text-[12px] opacity-70">{t.what}</p>
              </li>
            ))}
          </ul>
        </>
      ),
    },
  ]
  const last = step === steps.length - 1

  return (
    <dialog
      ref={ref}
      onClose={onDone}
      aria-labelledby="guide-title"
      className={`chip ${night ? 'chip-night' : ''} panel m-auto w-[min(92vw,28rem)] rounded-3xl p-0 font-display`}
    >
      <div className="flex items-center gap-3 px-6 pt-5">
        <p className="font-sans text-[12px] font-medium opacity-60">getting started · {step + 1} of {steps.length}</p>
        <button type="button" className="pill-btn -mr-2 ml-auto px-2" onClick={() => ref.current?.close()} aria-label="close">
          <Close size={18} />
        </button>
      </div>
      <div className="px-6 pb-2 pt-1">
        <h2 id="guide-title" className="text-xl font-bold tracking-[-0.02em]">{steps[step]!.title}</h2>
        <div className="mt-3 min-h-[11rem]">{steps[step]!.body}</div>
      </div>
      <div className="flex items-center gap-2 px-6 pb-5 pt-2">
        <span className="flex gap-1.5" aria-hidden="true">
          {steps.map((_, i) => <span key={i} className={`size-1.5 rounded-full ${i === step ? 'bg-current' : 'bg-current/20'}`} />)}
        </span>
        {step > 0 && <button type="button" className="pill-btn ml-auto" onClick={() => setStep(step - 1)}><span className="lbl">back</span></button>}
        <button type="button" className={`pill-btn chip-solid font-bold ${step === 0 ? 'ml-auto' : ''}`} onClick={() => (last ? ref.current?.close() : setStep(step + 1))}>
          <span className="lbl">{last ? 'done' : 'next'}</span>
          {!last && <ArrowRight size={14} />}
        </button>
      </div>
    </dialog>
  )
}
