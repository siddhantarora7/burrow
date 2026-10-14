'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_COLOR, formKey, growthOf, SPECIES, STAGES, stageOf, type Member } from '@burrow/core'
import { discovered, ranks } from '@/lib/grow'
import { fmtCost, fmtDur, fmtReply, fmtTokens, statRows, type StatMode } from '@/lib/stats'
import { toneOf } from '@/lib/pixel/sprites'
import { Close, Coins } from './icons'
import { Sprite } from './Sprite'

export type PanelName = 'stats' | 'catalog' | 'ranks'

/** A native modal dialog in the chip skin: Esc, the close button or a click outside dismisses it. */
function Panel({ title, sub, night, onClose, children, wide = false }: { title: string; sub: string; night: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current.close()}
      aria-labelledby="panel-title"
      className={`chip ${night ? 'chip-night' : ''} panel m-auto max-h-[85dvh] ${wide ? 'w-[min(94vw,34rem)]' : 'w-[min(92vw,30rem)]'} overflow-y-auto rounded-2xl p-0 font-display`}
    >
      <div className="sticky top-0 flex items-start gap-3 p-5 pb-3">
        <div className="min-w-0 flex-1">
          <h2 id="panel-title" className="text-lg font-bold">{title}</h2>
          <p className="mt-0.5 text-[13px] opacity-70">{sub}</p>
        </div>
        <button type="button" className="pill-btn -mr-2 -mt-1 px-2" onClick={() => ref.current?.close()} aria-label="close">
          <Close size={18} />
        </button>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </dialog>
  )
}

export function CatalogPanel({ catalog, members, night, onClose }: { catalog: string[]; members: Member[]; night: boolean; onClose: () => void }) {
  const found = discovered(catalog, members)
  const ink = night ? 'rgba(241, 238, 230, 0.22)' : 'rgba(38, 36, 31, 0.18)'
  return (
    <Panel title="catalog" sub={`${found.size} of ${SPECIES.length * STAGES.length} found in this garden.`} night={night} onClose={onClose}>
      <div className="grid grid-cols-[4.5rem_repeat(3,1fr)] items-center gap-x-2 gap-y-1">
        <span />
        {STAGES.map((s) => <span key={s} className="pb-1 text-center text-[12px] font-medium opacity-60">{s}</span>)}
        {SPECIES.map((sp) => (
          <div key={sp} className="contents">
            <span className="text-[13px] font-bold">{sp}</span>
            {STAGES.map((st) => {
              const known = found.has(formKey(sp, st))
              return (
                <span key={st} className="relative flex justify-center rounded-xl bg-current/[0.04] py-1" title={known ? `${sp}, ${st}` : 'not found yet'}>
                  <Sprite species={sp} color={DEFAULT_COLOR[sp]} stage={st} size={56} ink={known ? undefined : ink} />
                  {!known && <span className="absolute inset-0 flex items-center justify-center text-lg font-bold opacity-50" aria-label="not found yet">?</span>}
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </Panel>
  )
}

export function RanksPanel({ members, me, night, onClose }: { members: Member[]; me: string | null; night: boolean; onClose: () => void }) {
  return (
    <Panel title="this week" sub="koban earned this week. resets monday." night={night} onClose={onClose}>
      <ol className="flex flex-col gap-1">
        {ranks(members).map((r, i) => (
          <li key={r.member.petId} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${r.member.petId === me ? 'bg-current/[0.07]' : ''}`}>
            <span className="w-5 text-right text-[13px] font-bold tabular-nums opacity-60">{i + 1}</span>
            <Sprite species={r.member.species} color={toneOf(r.member.species, r.member.color)} stage={r.stage} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{r.member.name}{r.member.petId === me && <span className="ml-1.5 font-medium opacity-60">you</span>}</span>
              <span className="block text-[12px] opacity-60">{r.stage}</span>
            </span>
            <span className="flex items-center gap-1.5 font-bold tabular-nums">
              <Coins className="text-[#d49a2e]" />
              {r.weekKoban}
              <span className="sr-only">koban this week</span>
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

/** The garden's numbers: today or the last 7 days, by finished work, each with its activity by hour. */
export function StatsPanel({ members, me, night, onClose }: { members: Member[]; me: string | null; night: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<StatMode>('today')
  const rows = statRows(members, mode, new Date().toLocaleDateString('en-CA'))
  const max = Math.max(1, ...rows.flatMap((r) => r.s?.hourMs ?? []))
  return (
    <Panel title="stats" sub="worked out from each pet's hook events." night={night} onClose={onClose} wide>
      <div role="group" aria-label="period" className="mb-3 flex w-fit rounded-full bg-current/[0.06] p-0.5 font-sans text-[13px] font-medium">
        {(['today', 'week'] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`lbl h-7 rounded-full px-3 transition-colors ${mode === m ? 'chip-solid' : 'opacity-70 hover:opacity-100'}`}>
            {m === 'today' ? 'today' : 'this week'}
          </button>
        ))}
      </div>
      <ol className="flex flex-col gap-1">
        {rows.map(({ member: m, s }) => (
          <li key={m.petId} className={`rounded-xl px-2 py-2 ${m.petId === me ? 'bg-current/[0.07]' : ''}`}>
            <div className="flex items-center gap-3">
              <Sprite species={m.species} color={toneOf(m.species, m.color)} stage={stageOf(growthOf(m).xp)} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{m.name}{m.petId === me && <span className="ml-1.5 font-medium opacity-60">you</span>}</span>
                <span className="block font-sans text-[12px] opacity-70">
                  {s
                    ? [`${fmtDur(s.activeMs)} active`, `waited ${fmtDur(s.waitedMs)}`, s.replies ? `replies in ${fmtReply(s.replyMs / s.replies)}` : null, `${s.turns} turns`, s.tokens !== undefined ? `${fmtTokens(s.tokens)} tokens` : null, s.costUsd !== undefined ? fmtCost(s.costUsd) : null].filter(Boolean).join(' · ')
                    : 'no stats yet'}
                </span>
              </span>
              <span className="text-right font-bold tabular-nums">
                {s?.tasks ?? 0}
                <span className="block font-sans text-[11px] font-medium opacity-60">tasks</span>
              </span>
            </div>
            {s && s.activeMs > 0 && (
              <div className="mt-2 flex h-5 items-end gap-[2px] pl-12" aria-hidden="true">
                {s.hourMs.map((ms, h) => (
                  <span key={h} className="flex h-full flex-1 items-end rounded-[2px] bg-current/[0.07]" title={`${h}:00`}>
                    <span className="block w-full rounded-[2px] bg-[#d49a2e]" style={{ height: `${ms > 0 ? Math.max(12, (ms / max) * 100) : 0}%` }} />
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-4 font-sans text-[12px] leading-relaxed opacity-60">anyone with this garden&apos;s link can see these. tokens and cost appear only for pets whose owners share them, and are self-reported.</p>
    </Panel>
  )
}
