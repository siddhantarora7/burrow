'use client'
import { GROW, growthOf, nextStageAt, stageOf, type CareAction, type Member } from '@burrow/core'
import { toneOf } from '@/lib/pixel/sprites'
import { Coins, Sparkles, Utensils } from './icons'
import { Sprite } from './Sprite'

const STAGE_START = { baby: 0, grown: GROW.grownAt, evolved: GROW.evolvedAt } as const

/** Your own pet, when this browser is signed in: how far it has grown, your koban, and what they buy. */
export function CarePill({ member, night, onCare }: { member: Member; night: boolean; onCare: (a: CareAction) => void }) {
  const g = growthOf(member)
  const stage = stageOf(g.xp)
  const next = nextStageAt(g.xp)
  const from = STAGE_START[stage]
  const pct = next === null ? 100 : Math.round(((g.xp - from) / (next - from)) * 100)
  const label = next === null ? 'fully evolved' : `growth to ${stage === 'baby' ? 'grown' : 'evolved'}`
  return (
    <div className={`chip ${night ? 'chip-night' : ''} pill fixed bottom-[4.25rem] left-1/2 z-20 -translate-x-1/2 gap-2 pl-2 pr-1 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0`}>
      <Sprite species={member.species} color={toneOf(member.species, member.color)} stage={stage} size={28} />
      <span className="hidden flex-col gap-1.5 sm:flex">
        <span className="lbl font-bold">{member.name} <span className="font-medium opacity-70">{stage}</span></span>
        <span role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="block h-1 w-24 overflow-hidden rounded-full bg-current/15">
          <span className="block h-full rounded-full bg-[#f0c64e]" style={{ width: `${pct}%` }} />
        </span>
      </span>
      <span className="flex items-center gap-1.5 border-current/15 pl-1 sm:border-l sm:pl-3" title="koban: earned when your agent finishes a task or you answer it quickly">
        <Coins className="text-[#d49a2e]" />
        <span className="lbl font-bold tabular-nums">{g.koban}</span>
        <span className="sr-only">koban</span>
      </span>
      <button type="button" className="pill-btn" disabled={g.koban < GROW.feed.cost} onClick={() => onCare('feed')} aria-label={`feed ${member.name}, ${GROW.feed.cost} koban`}>
        <Utensils />
        <span className="lbl">feed · {GROW.feed.cost}</span>
      </button>
      <button type="button" className="pill-btn" disabled={g.koban < GROW.play.cost} onClick={() => onCare('play')} aria-label={`play with ${member.name}, ${GROW.play.cost} koban`}>
        <Sparkles />
        <span className="lbl">play · {GROW.play.cost}</span>
      </button>
    </div>
  )
}
