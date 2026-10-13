'use client'
import { useEffect, useRef, useState } from 'react'
import { SPECIES, STAGES, type PetState, type Stage } from '@burrow/core'
import { Coins, Sparkles } from '@/components/icons'
import { Sprite } from '@/components/Sprite'
import { toneOf } from '@/lib/pixel/sprites'

/** Where each chapter starts, as a share of the pinned scroll. */
const AT = { feed: 0.18, grown: 0.42, evolved: 0.66, collect: 0.82 }

const CHAPTERS = [
  { from: 0, title: 'it hatches tiny.', body: 'every pet starts as a baby.' },
  { from: AT.feed, title: 'work earns koban.', body: 'finished tasks and quick replies pay out. food costs 5.' },
  { from: AT.grown, title: 'it grows up.', body: 'feed it and play with it. at 100 xp it’s grown.' },
  { from: AT.evolved, title: 'then it evolves.', body: 'at 400 xp each pet gets its own look. mochi grows a sakura blossom.' },
  { from: AT.collect, title: 'collect all 18.', body: 'six pets, three forms each. your garden keeps a catalog of every form your friends reach.' },
]

const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n))
const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a))

/** 0 at the top of the pinned scroll, 1 at its end. */
function useProgress() {
  const ref = useRef<HTMLDivElement>(null)
  const [p, setP] = useState(0)
  useEffect(() => {
    let raf = 0
    const read = () => {
      raf = 0
      const r = ref.current?.getBoundingClientRect()
      if (r) setP(clamp(-r.top / (r.height - innerHeight)))
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(read) }
    read()
    addEventListener('scroll', on, { passive: true })
    addEventListener('resize', on)
    return () => { removeEventListener('scroll', on); removeEventListener('resize', on); cancelAnimationFrame(raf) }
  }, [])
  return { ref, p }
}

/** xp across the story: 0 → 100 while it eats, → 400 while it plays. */
function xpAt(p: number) {
  if (p < AT.feed) return 0
  if (p < AT.grown) return Math.round(span(p, AT.feed, AT.grown) * 100)
  return Math.round(100 + span(p, AT.grown, AT.evolved) * 300)
}

function stateAt(p: number): PetState {
  if (p < AT.feed) return 'idle'
  if (p < AT.grown) return 'eat'
  if (p < AT.evolved) return Math.floor(p * 60) % 2 ? 'cheer' : 'eat'
  return p < AT.evolved + 0.06 ? 'cheer' : 'idle'
}

/** A pixel koban: a gold oval with a darker rim and a stamp. */
function Koban({ style }: { style: React.CSSProperties }) {
  return <span className="absolute left-1/2 top-1/2 h-7 w-5 rounded-[50%] border-2 border-[#9a6a12] bg-[#ffd34f] shadow-[inset_-3px_0_0_#e8a92a]" style={style} aria-hidden="true" />
}

/** Coins flying into the pet while it eats: each loops along an arc in from the left. */
function Feeding({ t }: { t: number }) {
  return (
    <>
      {[0, 1, 2].map((k) => {
        const f = (t * 5 + k / 3) % 1
        const x = -190 + f * 190, y = 40 - Math.sin(f * Math.PI) * 120 - f * 40
        return <Koban key={k} style={{ translate: `calc(-50% + ${x}px) calc(-50% + ${y}px)`, opacity: f > 0.85 ? (1 - f) * 6 : 1, scale: 1 - f * 0.3 }} />
      })}
    </>
  )
}

/** Gold sparkles around the pet as it changes form; `k` is 1 at the moment of change. */
function Burst({ k }: { k: number }) {
  if (k <= 0) return null
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2, r = 110 + (1 - k) * 50
        return <Sparkles key={i} size={i % 2 ? 20 : 28} className="absolute left-1/2 top-1/2 text-[#e8a92a]" style={{ translate: `calc(-50% + ${Math.cos(a) * r}px) calc(-50% + ${Math.sin(a) * r}px)`, opacity: k }} />
      })}
    </>
  )
}

/** All 18 forms; found ones in colour, the rest as silhouettes. They fill in a scattered order. */
const FORMS = SPECIES.flatMap((s) => STAGES.map((st) => ({ s, st })))
const ORDER = [0, 4, 9, 13, 1, 7, 16, 3, 10, 5, 14, 2, 8, 17, 11, 6, 15, 12]
function Catalog({ found }: { found: number }) {
  const known = new Set(ORDER.slice(0, found))
  return (
    <div className="grid grid-cols-6 gap-1.5 rounded-[28px] bg-white p-4 shadow-[0_1px_2px_rgba(38,36,31,0.05),0_24px_48px_-20px_rgba(38,36,31,0.25)] sm:gap-3 sm:p-6">
      {FORMS.map(({ s, st }, i) => (
        <span key={i} className="relative flex size-11 items-center justify-center rounded-xl bg-[#f5f2ea] sm:size-16">
          <Sprite species={s} color={toneOf(s, undefined)} stage={st as Stage} state="idle" size={56} ink={known.has(i) ? undefined : '#d9d3c4'} className="!size-10 sm:!size-14" />
          {!known.has(i) && <span className="absolute font-display text-sm font-bold text-[#a29d92]">?</span>}
        </span>
      ))}
    </div>
  )
}

/** A pinned scroll: one pet hatches, eats, grows up and evolves, then the catalog fills. */
export function Evolution() {
  const { ref, p } = useProgress()
  const xp = xpAt(p)
  const stage: Stage = p < AT.grown ? 'baby' : p < AT.evolved ? 'grown' : 'evolved'
  const next = stage === 'baby' ? 100 : 400
  const chapter = CHAPTERS.findLastIndex((c) => p >= c.from)
  const koban = stage === 'evolved' ? 12 : 60 - Math.round(span(p, AT.feed, AT.evolved) * 48)
  const showCatalog = span(p, AT.collect - 0.02, AT.collect + 0.04)
  const burst = Math.max(1 - Math.abs(p - AT.grown) / 0.035, 1 - Math.abs(p - AT.evolved) / 0.035, 0)

  return (
    <section ref={ref} aria-label="how a pet grows up" className="relative h-[420svh]">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <ol className="hidden lg:block">
            {CHAPTERS.map((c, i) => (
              <li key={c.title} className={`border-l-2 py-4 pl-6 transition-[opacity,border-color] duration-300 ${i === chapter ? 'border-[#26241f] opacity-100' : 'border-[#26241f]/10 opacity-35'}`}>
                <h3 className="font-display text-[1.7rem] font-bold leading-tight tracking-[-0.025em]">{c.title}</h3>
                <p className={`overflow-hidden text-[16px] leading-relaxed text-[var(--muted)] transition-[max-height,margin] duration-300 ${i === chapter ? 'mt-1.5 max-h-24' : 'max-h-0'}`}>{c.body}</p>
              </li>
            ))}
          </ol>
          <div className="text-center lg:hidden" aria-live="off">
            <h3 className="font-display text-[1.9rem] font-bold tracking-[-0.025em]">{CHAPTERS[chapter]!.title}</h3>
            <p className="mx-auto mt-1 max-w-xs text-[15px] leading-relaxed text-[var(--muted)]">{CHAPTERS[chapter]!.body}</p>
          </div>

          <div className="relative flex h-[440px] items-center justify-center sm:h-[520px]">
            <div className="flex flex-col items-center" style={{ opacity: 1 - showCatalog, scale: 1 - showCatalog * 0.15 }}>
              <div className="relative">
                <Sprite species="mochi" color="sakura" stage={stage} state={stateAt(p)} size={280} animate className="!size-[200px] sm:!size-[280px]" />
                {stage !== 'evolved' && p >= AT.feed && <Feeding t={p} />}
                <Burst k={burst} />
              </div>
              <div className="mt-2 w-64 rounded-2xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(38,36,31,0.05),0_18px_40px_-18px_rgba(38,36,31,0.3)]">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="font-display font-bold">mochi <span className="font-sans font-medium text-[var(--muted)]">· {stage}</span></span>
                  <span className="flex items-center gap-1 font-semibold tabular-nums text-[#b07a12]"><Coins size={15} />{koban}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#efebe1]" role="progressbar" aria-label="xp" aria-valuemin={0} aria-valuemax={next} aria-valuenow={xp}>
                  <div className="h-full rounded-full bg-[#f4a3bc]" style={{ width: `${stage === 'evolved' ? 100 : (xp / next) * 100}%` }} />
                </div>
                <p className="mt-2 text-[12px] tabular-nums text-[var(--muted)]">{stage === 'evolved' ? `${xp} xp · fully grown` : `${xp} / ${next} xp`}</p>
              </div>
            </div>
            {showCatalog > 0 && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: showCatalog, scale: 0.9 + showCatalog * 0.1 }}>
                <Catalog found={Math.round(3 + span(p, AT.collect + 0.02, 0.97) * 15)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
