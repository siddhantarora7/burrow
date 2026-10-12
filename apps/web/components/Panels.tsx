'use client'
import { useEffect, useRef, type ReactNode } from 'react'
import { DEFAULT_COLOR, formKey, SPECIES, STAGES, type Member } from '@burrow/core'
import { discovered, ranks } from '@/lib/grow'
import { toneOf } from '@/lib/pixel/sprites'
import { Close, Coins } from './icons'
import { Sprite } from './Sprite'

export type PanelName = 'catalog' | 'ranks'

/** A native modal dialog in the chip skin: Esc, the close button or a click outside dismisses it. */
function Panel({ title, sub, night, onClose, children }: { title: string; sub: string; night: boolean; onClose: () => void; children: ReactNode }) {
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
      className={`chip ${night ? 'chip-night' : ''} panel m-auto max-h-[85dvh] w-[min(92vw,30rem)] overflow-y-auto rounded-2xl p-0 font-display`}
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
    <Panel title="catalog" sub={`${found.size} of ${SPECIES.length * STAGES.length} forms found in this garden. grow pets and invite friends to find the rest.`} night={night} onClose={onClose}>
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
    <Panel title="this week" sub="koban earned from finished tasks and quick replies. starts over every monday." night={night} onClose={onClose}>
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
