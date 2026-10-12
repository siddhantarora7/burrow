'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { bottomReserve, layoutGarden, pixelScale, POKE_GAP_MS, tagGap, TIMING, type DeriveResult, type GardenLayout, type Member, type PetColor, type PetState, type Species, growthOf, stageOf, type Stage, type CareAction } from '@burrow/core'
import { heartsAt, heartVisible, liveRipples, stepFly, stepHeart, stepLeaf, type Fly, type Heart, type Leaf, type Ripple } from '@/lib/pixel/ambient'
import { hash, paletteAt, phaseAt, type Palette } from '@/lib/pixel/palette'
import { bakeGlow, bakeGround, bakeLantern, bakeSky, GLOW, sunPosition, type Buffer } from '@/lib/pixel/scene'
import { colorsFor, FPS, FRAMES, GRID, petGrid, silhouette, toneOf } from '@/lib/pixel/sprites'
import { tagLabel, VERB, waitedLine } from '@/lib/status'
import { Pointer, Sparkles } from './icons'
import { careState, stageRises } from '@/lib/grow'

const BOT = 28
const CX = 16

function span(ms: number) {
  const m = Math.max(0, Math.round(ms / 60_000))
  return m < 1 ? 'a moment' : m < 60 ? `${m}m` : `${Math.round(m / 60)}h`
}
const ago = (ms: number) => (ms < 60_000 ? 'just now' : `${span(ms)} ago`)

/** Detail shown on hover or focus: what the agent did, and when. */
function detail(r: DeriveResult | undefined, now: number): string {
  if (!r?.lastEventAt) return 'no activity yet'
  const since = now - r.lastEventAt
  if (r.quiet) return `quiet for ${span(since)}, maybe interrupted`
  switch (r.state) {
    case 'eat': return 'just finished a task'
    case 'wave': return `waiting on you for ${span(since)}`
    case 'work': return `on a long run, last update ${ago(since)}`
    case 'cheer': return 'a friend shipped'
    case 'sleep': return `last seen ${ago(since)}`
    default: return `last update ${ago(since)}`
  }
}

// ---------- sprite cache: one tiny canvas per species/colour/state/frame ----------
const cache = new Map<string, HTMLCanvasElement>()
export function spriteCanvas(species: Species, color: PetColor, state: PetState, frame: number, quiet: boolean, stage: Stage = 'grown', known = true): HTMLCanvasElement {
  const key = `${species}:${color}:${state}:${frame}:${quiet}:${stage}:${known}`
  let c = cache.get(key)
  if (c) return c
  c = document.createElement('canvas')
  c.width = c.height = GRID
  const ctx = c.getContext('2d')!
  const colors = colorsFor(color)
  const grid = petGrid(species, state, frame, quiet, stage)
  ;(known ? grid : silhouette(grid)).forEach((row, y) =>
    row.forEach((v, x) => {
      if (!v) return
      ctx.fillStyle = colors[v]!
      ctx.fillRect(x, y, 1, 1)
    }),
  )
  cache.set(key, c)
  return c
}

function toCanvas(b: Buffer): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = b.w
  c.height = b.h
  c.getContext('2d')!.putImageData(new ImageData(b.data, b.w, b.h), 0, 0)
  return c
}

// ---------- screen size in logical pixels ----------
// Re-laying out the garden re-bakes it, so resizes settle first, unchanged sizes are ignored, and on
// touch screens the URL bar showing or hiding (a small height-only change) never moves the garden.
function useScreen() {
  const [s, setS] = useState<{ S: number; W: number; H: number } | null>(null)
  useEffect(() => {
    const touch = matchMedia('(pointer: coarse)').matches
    let timer: ReturnType<typeof setTimeout> | undefined
    const measure = () => {
      const vw = document.documentElement.clientWidth, vh = innerHeight
      const S = pixelScale(vw, vh)
      // width rounds up (overflow is clipped); height rounds down so the page never scrolls by a pixel
      const next = { S, W: Math.ceil(vw / S), H: Math.floor(vh / S) }
      setS((prev) => {
        if (prev && prev.S === next.S && prev.W === next.W && prev.H === next.H) return prev
        if (prev && touch && prev.W === next.W && Math.abs(prev.H - next.H) / prev.H < 0.15) return prev
        return next
      })
    }
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(measure, 120)
    }
    measure()
    addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      removeEventListener('resize', onResize)
    }
  }, [])
  return s
}

const HINT_KEY = 'burrow:hint-done'

interface Props {
  members: Member[]
  states: Map<string, DeriveResult>
  /** serverNow - Date.now(), so "2m ago" uses the server's clock like derive does. */
  offset: number
  hour: number
  /** The pet this browser speaks for (signed in), if any. */
  me?: string | null
  pokes?: ReadonlyArray<{ from: string; to: string; t: number }>
  onPoke?: (petId: string) => void
  /** The one-time boop hint and room for the bottom pills; both off inside the landing page's frame. */
  showHint?: boolean
  /** Recent feeds and plays (server time), so the pet eats or cheers on every screen. */
  cares?: ReadonlyArray<{ petId: string; effect: CareAction; t: number }>
  /** The care pill is showing: on phones it stacks above the invite pill, so the garden keeps more room. */
  careShown?: boolean
}

export function PixelBurrow({ members, states, offset, hour, me = null, pokes = [], onPoke, showHint = true, cares = [], careShown = false }: Props) {
  const screen = useScreen()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [, tick] = useState(0)

  const L: GardenLayout | null = useMemo(() => (screen ? layoutGarden(screen.W, screen.H, members.length, tagGap(screen.S), showHint ? bottomReserve(screen.S, screen.H > screen.W) + (careShown && screen.H > screen.W ? Math.ceil(56 / screen.S) : 0) : undefined) : null), [screen, members.length, showHint, careShown])
  const hourKey = Math.round(hour * 10) / 10
  const pal: Palette = useMemo(() => paletteAt(hourKey), [hourKey])
  const phase = useMemo(() => phaseAt(hourKey), [hourKey])
  const layers = useMemo(
    () =>
      L
        ? {
            sky: toCanvas(bakeSky(L, pal, phase)),
            ground: toCanvas(bakeGround(L, pal, phase)),
            lantern: toCanvas(bakeLantern(L, pal, phase)),
            // warm lamplight: full-colour gold pixels on a dither pattern, two densities for the flicker
            glow: GLOW.strength.map((k) => toCanvas(bakeGlow(GLOW.rx, GLOW.ry, k))),
          }
        : null,
    [L, pal, phase],
  )

  // A one-time cue that the garden answers back; gone after the first boop or pond tap.
  const [hint, setHint] = useState<string | null>(null)
  useEffect(() => {
    try {
      if (localStorage.getItem(HINT_KEY) === '1') return
    } catch {
      // private mode: show it
    }
    // mouse and trackpad users click; phones and tablets tap
    const verb = matchMedia('(hover: hover) and (pointer: fine)').matches ? 'click' : 'tap'
    setHint(`${verb} a pet to boop it, or ${verb} the pond`)
  }, [])
  const doneHint = () => {
    setHint(null)
    try {
      localStorage.setItem(HINT_KEY, '1')
    } catch {
      // private mode: the hint simply comes back next visit
    }
  }

  // Mutable animation state lives in a ref so the loop never re-renders React.
  const live = useRef({
    members, states, hover: null as string | null,
    boops: new Map<string, number>(),
    seenStops: new Map<string, number>(),
    ripples: [] as Ripple[],
    hearts: [] as Heart[],
    cares, offset,
    /** sparkle bursts when a pet reaches a new stage (performance.now()) */
    bursts: new Map<string, number>(),
    leaves: [] as Leaf[],
    flies: [] as Fly[],
    koi: [{ t: 0, speed: 0.35, color: '#f0823c', spot: '#ffffff' }, { t: Math.PI, speed: 0.28, color: '#f4efe6', spot: '#e2483f' }],
    clouds: [] as Array<{ x: number; y: number; w: number; speed: number }>,
  })
  live.current.members = members
  live.current.states = states
  live.current.hover = hover
  live.current.cares = cares
  live.current.offset = offset

  // A pet that reaches a new stage bursts into sparkles and the garden says so, once, on every screen.
  const stagesSeen = useRef<Map<string, Stage> | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  // the timer lives outside the effect: every event re-runs it, and that must not cancel a showing toast
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  useEffect(() => {
    const { rises, stages } = stageRises(stagesSeen.current, members)
    stagesSeen.current = stages
    if (!rises.length) return
    for (const r of rises) live.current.bursts.set(r.petId, performance.now())
    const r = rises.at(-1)!
    setToast(r.stage === 'evolved' ? `${r.name} evolved!` : `${r.name} grew up!`)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }, [members])

  // A ripple crosses the pond each time a pet finishes a task.
  useEffect(() => {
    if (!L) return
    const now = Date.now() + offset
    members.forEach((m, i) => {
      const lastStop = m.events.reduce((t, e) => (e.type === 'stop' ? Math.max(t, e.t) : t), 0)
      const seen = live.current.seenStops.get(m.petId)
      live.current.seenStops.set(m.petId, lastStop)
      if (seen === undefined || lastStop <= seen || now - lastStop > TIMING.eatMs) return
      const [x] = L.spots[i] ?? [L.pond.cx]
      const side = Math.sign(x - L.pond.cx) * Math.min(L.pond.rx - 8, Math.abs(x - L.pond.cx))
      live.current.ripples.push({ x: L.pond.cx + side, y: L.pond.cy, born: performance.now() })
    })
  }, [members, L, offset])

  // A poke makes its target hop on every screen in the burrow.
  const seenPoke = useRef(0)
  useEffect(() => {
    for (const p of pokes) if (p.t > seenPoke.current) live.current.boops.set(p.to, performance.now())
    seenPoke.current = Math.max(seenPoke.current, ...pokes.map((p) => p.t))
  }, [pokes])
  // Pokes you sent recently, so the tag can say so instead of offering another.
  const [poked, setPoked] = useState<Record<string, number>>({})

  // Refresh "2m ago" style details once a minute.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  // The draw loop.
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !L || !layers) return
    const ctx = cv.getContext('2d')!
    const st = live.current
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    st.clouds = Array.from({ length: L.portrait ? 2 : 3 }, (_, i) => ({ x: ((i + 0.3) * L.width) / 3, y: 10 + i * 9, w: 18 + i * 6, speed: 0.6 + i * 0.25 }))
    const sun = sunPosition(L)
    const { cx, cy, rx, ry } = L.pond
    const inPond = (x: number, y: number) => ((x - cx) / (rx - 1)) ** 2 + ((y - cy) / (ry - 1)) ** 2 <= 1
    const HEART = ['.R.R.', 'RRRRR', 'RRRRR', '.RRR.', '..R..']

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      ctx.clearRect(0, 0, L.width, L.height)
      ctx.drawImage(layers.sky, 0, 0)
      if (phase.night) {
        for (let i = 0; i < L.width * 0.35; i++) {
          const sx = Math.floor(hash(i, 1) * L.width), sy = Math.floor(hash(i, 2) * L.horizon * 0.8)
          if (Math.abs(sx - sun.x) < 10 && Math.abs(sy - sun.y) < 10) continue
          ctx.fillStyle = reduce || Math.sin(now / 600 + i) > 0.3 ? '#ffffff' : '#9fb0d8'
          ctx.fillRect(sx, sy, 1, 1)
        }
      } else {
        for (const c of st.clouds) {
          if (!reduce) c.x += (c.speed * dt * 3) / 1000
          if (c.x - c.w > L.width) c.x = -c.w
          const x = Math.round(c.x), y = Math.round(c.y)
          ctx.fillStyle = pal.cloudD
          ctx.fillRect(x - c.w / 2, y + 1, c.w, 3)
          ctx.fillStyle = pal.cloud
          ctx.fillRect(x - c.w / 2 + 1, y, c.w - 2, 3)
          for (const [dx, r] of [[-c.w / 5, 3], [0, 5], [c.w / 5, 4]] as const)
            for (let yy = -r; yy <= 0; yy++) {
              const half = Math.round(Math.sqrt(r * r - yy * yy))
              ctx.fillRect(Math.round(x + dx - half), y + yy, half * 2, 1)
            }
        }
      }
      ctx.drawImage(layers.ground, 0, 0)

      // pond life
      for (let i = 0; i < 14; i++) {
        const k = Math.floor(now / 700)
        const x = Math.round(cx - rx + hash(i, k) * rx * 2), y = Math.round(cy - ry + hash(i, k + 1) * ry * 2)
        if (inPond(x, y) && inPond(x + 2, y)) { ctx.fillStyle = pal.waterH; ctx.fillRect(x, y, 2, 1) }
      }
      for (const k of st.koi) {
        if (!reduce) k.t += (k.speed * dt) / 1000
        const x = Math.round(cx + Math.cos(k.t) * (rx - 10)), y = Math.round(cy + Math.sin(k.t) * (ry - 5))
        const dir = -Math.sin(k.t) >= 0 ? 1 : -1
        ctx.fillStyle = k.color
        ctx.fillRect(x - 2, y, 5, 2)
        ctx.fillRect(x - 3 * dir - (dir < 0 ? 1 : 0), y + (Math.floor(now / 200) % 2), 1, 1)
        ctx.fillStyle = k.spot
        ctx.fillRect(x + (dir > 0 ? 1 : -1), y, 1, 1)
      }
      const ripples = liveRipples(st.ripples, now)
      st.ripples = ripples
      ctx.fillStyle = pal.waterH
      for (const r of ripples) {
        const R = 2 + r.age * 16
        for (let a = 0; a < Math.PI * 2; a += 0.08) {
          const x = Math.round(r.x + Math.cos(a) * R), y = Math.round(r.y + Math.sin(a) * R * 0.32)
          if (inPond(x, y) && (r.age < 1 || hash(x, y) > 0.5)) ctx.fillRect(x, y, 1, 1)
        }
      }
      if (phase.night) {
        // additive, dithered halo; the lantern is redrawn on top so its silhouette and window survive
        const bright = reduce || Math.sin(now / 90) + Math.sin(now / 37) * 0.5 > -0.2
        ctx.drawImage(layers.glow[bright ? 1 : 0]!, L.lantern.x - GLOW.rx, L.lantern.y - 12 - GLOW.ry)
        ctx.drawImage(layers.lantern, 0, 0)
      }

      // pets, back to front
      const order = st.members.map((m, i) => ({ m, i })).filter(({ i }) => L.spots[i]).sort((a, b) => L.spots[a.i]![1] - L.spots[b.i]![1])
      for (const { m, i } of order) {
        const [x, y] = L.spots[i]!
        const r = st.states.get(m.petId)
        // a feed or play shows for a moment, over whatever the agent is doing
        const state = careState(st.cares, m.petId, Date.now() + st.offset) ?? r?.state ?? 'sleep'
        const f = reduce ? 0 : Math.floor((now / 1000) * FPS[state] + i * 1.7) % FRAMES[state]
        const boopT = (now - (st.boops.get(m.petId) ?? -1e9)) / 1000
        const hop = boopT < 0.45 ? Math.round(Math.sin((boopT / 0.45) * Math.PI) * 5) : 0
        ctx.drawImage(spriteCanvas(m.species, toneOf(m.species, m.color), state, f, !!r?.quiet, stageOf(growthOf(m).xp)), x - CX, y - BOT - 1 - hop)
        if (st.hover === m.petId) {
          // a soft selection ring on the stone
          ctx.fillStyle = '#ffffff'
          for (let a = 0; a < Math.PI * 2; a += 0.22) ctx.fillRect(Math.round(x + Math.cos(a) * 13), Math.round(y + 1 + Math.sin(a) * 4), 1, 1)
        }
      }

      // falling maple leaves that rest on the gravel for a while
      if (!reduce && Math.random() < dt / 2200 && st.leaves.length < 10)
        st.leaves.push({ x: L.maple.x + (Math.random() - 0.5) * 50, y: L.maple.y - 30, ground: L.gravelTop + 4 + Math.random() * (L.height - L.gravelTop - 10), rest: 0, seed: Math.random() * 10 })
      st.leaves = st.leaves.filter((l) => {
        const alive = stepLeaf(l, dt, now)
        ctx.fillStyle = l.y < l.ground && Math.floor(now / 250 + l.seed) % 2 ? pal.mapleH : pal.maple
        ctx.fillRect(Math.round(l.x), Math.round(l.y), 2, 1)
        return alive
      })
      if (phase.night && !reduce) {
        if (st.flies.length < 9) st.flies.push({ x: Math.random() * L.width, y: L.gravelTop - 4 + Math.random() * 30, s: Math.random() * 10 })
        ctx.fillStyle = '#f7e78a'
        for (const fl of st.flies) {
          stepFly(fl, dt, now)
          if (Math.sin(now / 300 + fl.s * 3) > 0.2) ctx.fillRect(Math.round(fl.x), Math.round(fl.y), 1, 1)
        }
      } else st.flies = []
      // stage-up sparkles: eight gold rays that spread from the pet and blink out over 1.2 s
      ctx.fillStyle = '#ffd34f'
      for (const [petId, born] of st.bursts) {
        const age = (now - born) / 1200
        const i = st.members.findIndex((m) => m.petId === petId)
        if (age > 1 || i < 0 || !L.spots[i]) { st.bursts.delete(petId); continue }
        const [bx, by] = L.spots[i]!
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2, rr = 6 + age * 14
          if (reduce || Math.floor(now / 90 + k) % 3) ctx.fillRect(Math.round(bx + Math.cos(a) * rr), Math.round(by - 14 + Math.sin(a) * rr * 0.8), 1, 1)
        }
      }
      st.hearts = st.hearts.filter((h) => stepHeart(h, dt))
      ctx.fillStyle = '#ff6f91'
      for (const h of st.hearts) {
        if (heartVisible(h)) HEART.forEach((row, j) => [...row].forEach((c, k) => { if (c !== '.') ctx.fillRect(Math.round(h.x) - 2 + k, Math.round(h.y) + j, 1, 1) }))
      }
      raf = requestAnimationFrame(frame)
    }
    const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame) } }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    const onVisibility = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVisibility)
    start()
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [L, layers, pal, phase])

  if (!screen || !L) return null
  const S = screen.S
  const now = Date.now() + offset
  const todayKey = new Date().toLocaleDateString('en-CA')

  const boop = (petId: string, i: number) => {
    const [x, y] = L.spots[i]!
    live.current.boops.set(petId, performance.now())
    live.current.hearts.push(...heartsAt(x, y))
  }
  const petAt = (mx: number, my: number) => L.spots.findIndex(([x, y], i) => i < members.length && mx > x - 12 && mx < x + 12 && my > y - 22 && my < y + 3)
  const onPond = (mx: number, my: number) => ((mx - L.pond.cx) / L.pond.rx) ** 2 + ((my - L.pond.cy) / L.pond.ry) ** 2 <= 1
  const local = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return [(e.clientX - r.left) / S, (e.clientY - r.top) / S] as const
  }

  return (
    <div className="relative" style={{ width: L.width * S, height: L.height * S }}>
      <canvas
        ref={canvasRef}
        width={L.width}
        height={L.height}
        className={`absolute inset-0 [image-rendering:pixelated] ${hover ? 'cursor-pointer' : ''}`}
        // own compositing layer: the frosted chrome above must not re-blur it every frame
        style={{ width: L.width * S, height: L.height * S, willChange: 'transform' }}
        aria-hidden="true"
        onMouseMove={(e) => {
          const [mx, my] = local(e)
          const i = petAt(mx, my)
          setHover(i >= 0 ? members[i]!.petId : onPond(mx, my) ? 'pond' : null)
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const [mx, my] = local(e)
          const i = petAt(mx, my)
          if (i >= 0) {
            doneHint()
            return boop(members[i]!.petId, i)
          }
          if (onPond(mx, my)) {
            doneHint()
            live.current.ripples.push({ x: Math.round(mx), y: Math.round(my), born: performance.now() })
            live.current.koi.forEach((k) => (k.speed *= 3))
            setTimeout(() => live.current.koi.forEach((k) => (k.speed /= 3)), 900)
          }
        }}
      />
      {members.map((m, i) => {
        const spot = L.spots[i]
        if (!spot) return null
        const r = states.get(m.petId)
        const state = r?.state ?? 'sleep'
        const verb = r?.quiet ? 'quiet' : VERB[state]
        const open = hover === m.petId
        // a signed-in friend can poke a waiting pet, once a minute
        const pokable = !!onPoke && !!me && me !== m.petId && state === 'wave'
        const justPoked = Date.now() - (poked[m.petId] ?? -Infinity) < POKE_GAP_MS
        const info = [me === m.petId ? 'you' : null, detail(r, now), waitedLine(m.today, todayKey)].filter(Boolean).join(' · ')
        const more = pokable ? `${info} · ${justPoked ? 'poked' : 'press to poke'}` : info
        return (
          <button
            key={m.petId}
            type="button"
            className={`tag chip absolute -translate-x-1/2 ${phase.night ? 'chip-night' : ''} ${state === 'wave' ? 'tag-alert' : ''} ${open ? 'tag-open' : ''}`}
            style={{ left: spot[0] * S, top: (spot[1] + 6) * S }}
            onMouseEnter={() => setHover(m.petId)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(m.petId)}
            onBlur={() => setHover(null)}
            onClick={() => {
              doneHint()
              if (pokable && !justPoked) {
                onPoke(m.petId)
                setPoked((p) => ({ ...p, [m.petId]: Date.now() }))
              } else boop(m.petId, i)
            }}
            aria-label={tagLabel(m.name, verb, info, pokable && !justPoked ? 'poke' : 'boop')}
          >
            {m.name}
            <i>{verb}</i>
            {open && <b className="tag-more">{more}</b>}
          </button>
        )
      })}
      {showHint && hint && members.length > 0 && (
        <p className={`hint chip ${phase.night ? 'chip-night' : ''} pill fixed left-1/2 z-20 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 ${careShown ? 'bottom-[7.5rem] sm:bottom-[4.5rem]' : 'bottom-[4.5rem] sm:bottom-6'}`}>
          <Pointer className="opacity-60" />
          <span className="lbl">{hint}</span>
        </p>
      )}
      <p aria-live="polite" className={`fixed left-1/2 top-[4.25rem] z-30 -translate-x-1/2 sm:top-20 ${toast ? `hint chip ${phase.night ? 'chip-night' : ''} pill font-bold` : 'sr-only'}`}>
        {toast && <Sparkles className="text-[#d49a2e]" />}
        <span className="lbl">{toast}</span>
      </p>
    </div>
  )
}
