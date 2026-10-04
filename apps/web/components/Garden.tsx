import type { ReactNode } from 'react'
import type { GardenGeometry } from '@burrow/core'
import type { Sky } from '@/lib/sky'

// Coordinates are rounded because Node and browsers may disagree on the last digit of
// Math.cos/sin, which breaks hydration. Everything random is seeded for the same reason.
const q = (n: number) => Math.round(n * 10) / 10
function rand(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

const shade = (hex: string, k: number) => {
  // k < 0 darkens toward black, k > 0 lightens toward white
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return '#' + c.map((v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k).toString(16).padStart(2, '0')).join('')
}

/** A hand-made closed contour around an ellipse: same seed, same wobble, every render. */
function wobbleEllipse(cx: number, cy: number, rx: number, ry: number, seed: number, amp = 0.05, n = 14): string {
  const r = rand(seed)
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const k = 1 - amp + r() * amp * 2
    return [q(cx + Math.cos(a) * rx * k), q(cy + Math.sin(a) * ry * k)] as const
  })
  const mid = (i: number) => {
    const [ax, ay] = pts[i % n]!, [bx, by] = pts[(i + 1) % n]!
    return `${q((ax + bx) / 2)} ${q((ay + by) / 2)}`
  }
  return `M${mid(0)} ` + pts.map((_, i) => `Q${pts[(i + 1) % n]!.join(' ')} ${mid(i + 1)}`).join(' ') + ' Z'
}

function Stars({ w, h }: { w: number; h: number }) {
  const r = rand(17)
  return (
    <g>
      {Array.from({ length: Math.round((w * h) / 9000) }, (_, i) => (
        <circle key={i} cx={q(r() * w)} cy={q(r() * h)} r={(i % 3) * 0.6 + 0.8} fill="#fff" opacity={0.25 + (i % 4) * 0.15} />
      ))}
    </g>
  )
}

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${q(x)} ${q(y)}) scale(${s})`} fill="#fff" opacity={0.62}>
      <rect x={-90} y={-14} width={180} height={30} rx={15} />
      <circle cx={-38} cy={-16} r={28} />
      <circle cx={8} cy={-28} r={36} />
      <circle cx={52} cy={-12} r={24} />
    </g>
  )
}

/** A Japanese maple: flat, layered tiers of foliage on a dark trunk, cut off by the wall below. */
function Maple({ x, y, scale, leaf, night }: { x: number; y: number; scale: number; leaf: string; night: boolean }) {
  const base = night ? shade(leaf, -0.55) : leaf
  const r = rand(5)
  const tiers = [
    { y: -150, w: 330 },
    { y: -215, w: 280 },
    { y: -272, w: 200 },
    { y: -318, w: 110 },
  ]
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 0 C-4 -50 -8 -100 -30 -150 M-6 -70 C18 -110 46 -140 84 -168 M-22 -128 C-56 -160 -84 -182 -112 -196 M-4 -150 C0 -200 8 -240 4 -290" stroke={night ? '#2A221C' : '#4E3A2C'} strokeWidth={13} fill="none" strokeLinecap="round" />
      {tiers.map((t, i) => {
        const n = Math.round(t.w / 46)
        const lobes = Array.from({ length: n }, (_, k) => ({
          x: q(-t.w / 2 + (k + 0.5) * (t.w / n) + (r() - 0.5) * 14),
          ry: q(24 + r() * 10),
        }))
        return (
          <g key={i}>
            {/* underside shadow, then the tier, then a thin lit top edge */}
            {lobes.map((l, k) => <ellipse key={`s${k}`} cx={l.x} cy={t.y + 9} rx={34} ry={l.ry} fill={shade(base, -0.3)} />)}
            {lobes.map((l, k) => <ellipse key={`m${k}`} cx={l.x} cy={t.y} rx={33} ry={l.ry} fill={base} />)}
            {lobes.map((l, k) => <ellipse key={`h${k}`} cx={l.x - 6} cy={q(t.y - l.ry * 0.45)} rx={20} ry={q(l.ry * 0.38)} fill={shade(base, 0.16)} opacity={0.55} />)}
          </g>
        )
      })}
    </g>
  )
}

function FallenLeaves({ x, y, scale, leaf, night }: { x: number; y: number; scale: number; leaf: string; night: boolean }) {
  const r = rand(11)
  const base = night ? shade(leaf, -0.55) : leaf
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {Array.from({ length: 10 }, (_, i) => {
        const fx = q(-240 + r() * 380), fy = q(60 + r() * 130)
        return <ellipse key={i} cx={fx} cy={fy} rx={7} ry={3.5} transform={`rotate(${Math.round(r() * 180)} ${fx} ${fy})`} fill={base} opacity={0.85} />
      })}
    </g>
  )
}

/** Stone toro lantern: base, pillar, six-sided firebox, upturned kasa roof, finial. */
function Lantern({ x, y, scale, lit, shadowDx }: { x: number; y: number; scale: number; lit: boolean; shadowDx: number }) {
  const stone = '#9C998F', dark = '#7D7A73'
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx={shadowDx} cy={4} rx={70} ry={11} fill="#000" opacity={lit ? 0.08 : 0.12} />
      {lit && <circle cx={0} cy={-96} r={100} fill="url(#lanternGlow)" />}
      <path d={wobbleEllipse(0, 2, 56, 9, 3, 0.12)} fill="#8EA35C" opacity={0.75} />
      <path d="M-34 0 L-30 -16 H30 L34 0 Z" fill={dark} />
      <rect x={-12} y={-72} width={24} height={58} rx={3} fill={stone} />
      <path d="M-30 -70 H30 L26 -80 H-26 Z" fill={dark} />
      <path d="M-22 -80 L-24 -112 H24 L22 -80 Z" fill={stone} />
      <path d="M-11 -86 L-12 -106 H12 L11 -86 Z" fill={lit ? '#FFD58A' : '#6E6B64'} />
      <path d="M-1 -86 V-106" stroke={stone} strokeWidth={3} />
      <path d="M-56 -110 Q-40 -114 -28 -120 L0 -136 L28 -120 Q40 -114 56 -110 Q44 -118 34 -128 L0 -146 L-34 -128 Q-44 -118 -56 -110 Z" fill={dark} />
      <circle cx={0} cy={-152} r={7} fill={dark} />
    </g>
  )
}

function Wall({ g, night }: { g: GardenGeometry; night: boolean }) {
  const top = g.wallY
  const bottom = g.gravelY + 6
  const plaster = night ? '#3A3630' : '#DCCDAE'
  const line = night ? '#4C473F' : '#F6F0E2'
  const tile = night ? '#22242A' : '#4A4E57'
  return (
    <g>
      <rect x={0} y={top} width={g.w} height={bottom - top} fill={plaster} />
      {[0.42, 0.58, 0.74].map((f) => (
        <rect key={f} x={0} y={q(top + (bottom - top) * f)} width={g.w} height={2.5} fill={line} opacity={0.85} />
      ))}
      <rect x={0} y={bottom - 10} width={g.w} height={10} fill={night ? '#2E2B26' : '#B9AC92'} />
      <rect x={0} y={top} width={g.w} height={8} fill="#000" opacity={0.1} />
      <rect x={-10} y={top - 18} width={g.w + 20} height={20} rx={6} fill={tile} />
      {Array.from({ length: Math.ceil(g.w / 18) + 1 }, (_, i) => (
        <circle key={i} cx={i * 18} cy={top + 2} r={5.5} fill={tile} />
      ))}
      <rect x={-10} y={top - 22} width={g.w + 20} height={6} rx={3} fill={shade(tile, 0.12)} />
    </g>
  )
}

export function Garden({
  g,
  sky,
  leaf,
  fallen,
  children,
}: {
  g: GardenGeometry
  sky: Sky
  leaf: string
  fallen: boolean
  children?: ReactNode
}) {
  const { w, h, wallY, gravelY, pond } = g
  const gravel = sky.night ? '#2B2E35' : '#E6E4DA'
  const groove = sky.night ? '#24272D' : '#CFCABD'
  const ridge = sky.night ? '#353943' : '#F1EFE7'
  const tall = h > w
  const sun = { x: w * (tall ? 0.22 : 0.26), y: wallY * (tall ? 0.36 : 0.42) }
  // Shadows fall away from the sun (or the moon).
  const shadowDx = sun.x < w / 2 ? 26 : -26
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky.top} /><stop offset="1" stopColor={sky.bottom} /></linearGradient>
        <linearGradient id="pond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky.bottom} /><stop offset="1" stopColor={sky.top} /></linearGradient>
        <radialGradient id="lanternGlow"><stop offset="0" stopColor="#FFD58A" stopOpacity=".55" /><stop offset="1" stopColor="#FFD58A" stopOpacity="0" /></radialGradient>
        <radialGradient id="sunGlow"><stop offset=".35" stopColor="#FFE9A8" stopOpacity=".35" /><stop offset="1" stopColor="#FFE9A8" stopOpacity="0" /></radialGradient>
      </defs>

      <rect width={w} height={wallY + 20} fill="url(#sky)" />
      {sky.night ? (
        <>
          <Stars w={w} h={wallY - 40} />
          <circle cx={q(sun.x)} cy={q(sun.y)} r={34} fill="#F3EFD8" />
          <circle cx={q(sun.x + 13)} cy={q(sun.y - 8)} r={30} fill={sky.top} opacity={0.92} />
        </>
      ) : (
        <>
          <circle cx={q(sun.x)} cy={q(sun.y)} r={110} fill="url(#sunGlow)" />
          <circle cx={q(sun.x)} cy={q(sun.y)} r={46} fill="#FFE9A8" />
          {/* Kept inside the band every aspect ratio shows, so wide screens never flatten them. */}
          <Cloud x={w * 0.52} y={wallY * 0.42} s={tall ? 0.8 : 1} />
          {!tall && <Cloud x={w * 0.7} y={wallY * 0.6} s={0.7} />}
        </>
      )}

      <path
        d={`M0 ${wallY} C ${q(w * 0.12)} ${wallY - 90} ${q(w * 0.24)} ${wallY - 70} ${q(w * 0.35)} ${wallY - 40} S ${q(w * 0.56)} ${wallY - 100} ${q(w * 0.7)} ${wallY - 60} S ${q(w * 0.9)} ${wallY - 90} ${w} ${wallY - 50} V${wallY + 20} H0Z`}
        fill={sky.night ? '#1C2340' : '#B9C9CF'}
        opacity={0.6}
      />

      <Maple {...g.maple} leaf={leaf} night={sky.night} />
      <Wall g={g} night={sky.night} />

      <rect x={0} y={gravelY + 6} width={w} height={h} fill={gravel} />
      {/* Raked grooves: each line is a shadowed trough with a lit ridge beside it. */}
      {Array.from({ length: Math.ceil((h - gravelY) / 22) }, (_, i) => {
        const y = gravelY + 24 + i * 22
        const d = `M0 ${y} Q ${w / 4} ${y - 5} ${w / 2} ${y} T ${w} ${y}`
        return (
          <g key={i}>
            <path d={d} stroke={groove} strokeWidth={2.2} fill="none" />
            <path d={d} transform="translate(0 -2.4)" stroke={ridge} strokeWidth={1.4} fill="none" />
          </g>
        )
      })}

      {fallen && <FallenLeaves {...g.maple} leaf={leaf} night={sky.night} />}

      {[3, 2, 1].map((k) => (
        <ellipse key={k} cx={pond.cx} cy={pond.cy} rx={pond.rx + k * 26} ry={pond.ry + k * 12} fill={gravel} stroke={groove} strokeWidth={2.2} />
      ))}
      <path d={wobbleEllipse(pond.cx, pond.cy + 3, pond.rx + 14, pond.ry + 11, 7, 0.03)} fill="#85827B" />
      <path d={wobbleEllipse(pond.cx, pond.cy, pond.rx + 11, pond.ry + 8, 7, 0.03)} fill="#A3A099" />
      <path d={wobbleEllipse(pond.cx, pond.cy, pond.rx, pond.ry, 8, 0.025)} fill="url(#pond)" />
      <ellipse cx={q(pond.cx - pond.rx * 0.36)} cy={q(pond.cy - pond.ry * 0.22)} rx={q(pond.rx * 0.28)} ry={6} fill="#fff" opacity={0.18} />
      <path d={wobbleEllipse(pond.cx + pond.rx * 0.48, pond.cy + pond.ry * 0.27, 26, 9, 4, 0.1)} fill="#7E9C55" />

      {g.moss.map((m, i) => (
        <path key={i} d={wobbleEllipse(m.x, m.y, m.rx, m.ry, 20 + i, 0.12)} fill="#8EA35C" opacity={sky.night ? 0.5 : 0.9} />
      ))}

      <Lantern {...g.lantern} lit={sky.night} shadowDx={shadowDx} />
      {children}
    </svg>
  )
}

/** A flat stepping stone with rake rings and a soft cast shadow, drawn under a pet. */
export function Stone({ x, y, scale, night, shadowDx = 18 }: { x: number; y: number; scale: number; night: boolean; shadowDx?: number }) {
  const rx = 82 * scale, ry = 24 * scale
  const groove = night ? '#24272D' : '#CFCABD'
  const gravel = night ? '#2B2E35' : '#E6E4DA'
  const top = wobbleEllipse(x, y, rx, ry, Math.round(x * 31 + y), 0.07, 9)
  return (
    <g>
      {[2, 1].map((k) => (
        <ellipse key={k} cx={x} cy={y} rx={q(rx + k * 22)} ry={q(ry + k * 10)} fill={gravel} stroke={groove} strokeWidth={2.2} />
      ))}
      <ellipse cx={q(x + shadowDx * scale)} cy={q(y + 8)} rx={q(rx * 1.02)} ry={q(ry * 1.05)} fill="#000" opacity={night ? 0.14 : 0.09} />
      <path d={top} transform="translate(0 6)" fill={night ? '#4A4842' : '#85827B'} />
      <path d={top} fill={night ? '#5E5C55' : '#A8A59D'} />
      <ellipse cx={q(x - rx * 0.3)} cy={q(y - ry * 0.35)} rx={q(rx * 0.35)} ry={q(ry * 0.25)} fill="#fff" opacity={0.16} />
    </g>
  )
}

/** Pond ripples live in their own layer so their animation never repaints the garden under the glass. */
export function Ripples({ g, ripples }: { g: GardenGeometry; ripples: Array<{ key: string; x: number }> }) {
  const { pond } = g
  if (ripples.length === 0) return null
  return (
    <svg viewBox={`0 0 ${g.w} ${g.h}`} className="ripple-layer absolute inset-0 h-full w-full" aria-hidden="true">
      {ripples.map((rp) => {
        // Start on the pond, toward the pet that shipped.
        const cx = Math.max(pond.cx - pond.rx + 70, Math.min(pond.cx + pond.rx - 70, rp.x))
        return (
          <g key={rp.key}>
            <ellipse className="ripple" cx={cx} cy={pond.cy} rx={70} ry={22} fill="none" stroke="#fff" strokeWidth={3} />
            <ellipse className="ripple r2" cx={cx} cy={pond.cy} rx={70} ry={22} fill="none" stroke="#fff" strokeWidth={2} />
          </g>
        )
      })}
    </svg>
  )
}
