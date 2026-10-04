import type { ReactNode } from 'react'
import type { GardenGeometry } from '@burrow/core'
import type { Sky } from '@/lib/sky'

// Seeded so the server and client render identical markup. Coordinates are rounded because
// Node and browsers may disagree on the last digit of Math.cos/sin, which breaks hydration.
const q = (n: number) => Math.round(n * 10) / 10

// Seeded so the server and client render identical markup.
function rand(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

const shade = (hex: string, k: number) => {
  // k < 0 darkens toward black, k > 0 lightens toward white
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return '#' + c.map((v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k).toString(16).padStart(2, '0')).join('')
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
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff" opacity={0.62}>
      <rect x={-90} y={-14} width={180} height={30} rx={15} />
      <circle cx={-38} cy={-16} r={28} />
      <circle cx={8} cy={-28} r={36} />
      <circle cx={52} cy={-12} r={24} />
    </g>
  )
}

function Maple({ x, y, scale, leaf, night, fallen }: { x: number; y: number; scale: number; leaf: string; night: boolean; fallen: boolean }) {
  const r = rand(5)
  const puffs = Array.from({ length: 26 }, (_, i) => {
    const a = (i / 26) * Math.PI * 2 + r() * 0.5
    const d = Math.sqrt(r())
    return { x: q(Math.cos(a) * 165 * d), y: q(-215 + Math.sin(a) * 105 * d), rad: q(38 + r() * 26) }
  }).sort((p, q) => p.y - q.y)
  const base = night ? shade(leaf, -0.55) : leaf
  if (fallen) {
    // Leaves on the gravel only; drawn in a later pass so they sit on top of the rake lines.
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`}>
        {Array.from({ length: 9 }, (_, i) => {
          const fx = q(-220 + r() * 360), fy = q(70 + r() * 120)
          return <ellipse key={i} cx={fx} cy={fy} rx={7} ry={3.5} transform={`rotate(${Math.round(r() * 180)} ${fx.toFixed(1)} ${fy.toFixed(1)})`} fill={base} opacity={0.85} />
        })}
      </g>
    )
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 0 C-4 -60 -10 -110 -40 -170 M-6 -80 C20 -120 50 -150 90 -190 M-24 -136 C-60 -170 -90 -190 -120 -200" stroke={night ? '#2A221C' : '#5A4434'} strokeWidth={14} fill="none" strokeLinecap="round" />
      {puffs.map((p, i) => <circle key={`u${i}`} cx={p.x} cy={p.y + 10} r={p.rad} fill={shade(base, -0.28)} />)}
      {puffs.map((p, i) => <circle key={`m${i}`} cx={p.x} cy={p.y} r={p.rad * 0.92} fill={base} />)}
      {puffs.filter((_, i) => i % 3 === 0).map((p, i) => <circle key={`h${i}`} cx={p.x - p.rad * 0.2} cy={p.y - p.rad * 0.25} r={p.rad * 0.62} fill={shade(base, 0.14)} opacity={0.45} />)}
    </g>
  )
}

function Lantern({ x, y, scale, lit }: { x: number; y: number; scale: number; lit: boolean }) {
  // Stone toro lantern: base, pillar, light box, roof, finial.
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {lit && <circle cx={0} cy={-92} r={95} fill="url(#lanternGlow)" />}
      <ellipse cx={0} cy={2} rx={58} ry={10} fill="#8EA35C" opacity={0.7} />
      <rect x={-34} y={-16} width={68} height={16} rx={4} fill="#8C8982" />
      <rect x={-13} y={-74} width={26} height={60} rx={4} fill="#9C998F" />
      <rect x={-30} y={-80} width={60} height={10} rx={3} fill="#8C8982" />
      <rect x={-22} y={-114} width={44} height={36} rx={3} fill="#9C998F" />
      <rect x={-11} y={-106} width={22} height={20} rx={2} fill={lit ? '#FFD58A' : '#6E6B64'} />
      <path d="M-48 -112 Q0 -142 48 -112 L38 -108 Q0 -128 -38 -108 Z" fill="#7D7A73" />
      <circle cx={0} cy={-136} r={7} fill="#7D7A73" />
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
        <rect key={f} x={0} y={top + (bottom - top) * f} width={g.w} height={2.5} fill={line} opacity={0.85} />
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
  ripples = [],
  children,
}: {
  g: GardenGeometry
  sky: Sky
  leaf: string
  fallen: boolean
  ripples?: Array<{ key: string; x: number }>
  children?: ReactNode
}) {
  const { w, h, wallY, gravelY, pond } = g
  const gravel = sky.night ? '#2B2E35' : '#E6E4DA'
  const rake = sky.night ? '#353943' : '#D3CFC2'
  const tall = h > w
  const sun = { x: w * (tall ? 0.22 : 0.26), y: wallY * (tall ? 0.36 : 0.4) }
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
          <circle cx={sun.x} cy={sun.y} r={34} fill="#F3EFD8" />
          <circle cx={sun.x + 13} cy={sun.y - 8} r={30} fill={sky.top} opacity={0.92} />
        </>
      ) : (
        <>
          <circle cx={sun.x} cy={sun.y} r={110} fill="url(#sunGlow)" />
          <circle cx={sun.x} cy={sun.y} r={46} fill="#FFE9A8" />
          <Cloud x={w * 0.52} y={wallY * 0.3} s={tall ? 0.8 : 1.1} />
          {!tall && <Cloud x={w * 0.7} y={wallY * 0.55} s={0.75} />}
        </>
      )}

      <path
        d={`M0 ${wallY} C ${w * 0.12} ${wallY - 90} ${w * 0.24} ${wallY - 70} ${w * 0.35} ${wallY - 40} S ${w * 0.56} ${wallY - 100} ${w * 0.7} ${wallY - 60} S ${w * 0.9} ${wallY - 90} ${w} ${wallY - 50} V${wallY + 20} H0Z`}
        fill={sky.night ? '#1C2340' : '#B9C9CF'}
        opacity={0.6}
      />

      <Maple {...g.maple} leaf={leaf} night={sky.night} fallen={false} />
      <Wall g={g} night={sky.night} />

      <rect x={0} y={gravelY + 6} width={w} height={h} fill={gravel} />
      {Array.from({ length: Math.ceil((h - gravelY) / 22) }, (_, i) => {
        const y = gravelY + 24 + i * 22
        return <path key={i} d={`M0 ${y} Q ${w / 4} ${y - 5} ${w / 2} ${y} T ${w} ${y}`} stroke={rake} strokeWidth={2.2} fill="none" />
      })}

      {fallen && <Maple {...g.maple} leaf={leaf} night={sky.night} fallen />}

      {[3, 2, 1].map((k) => (
        <ellipse key={k} cx={pond.cx} cy={pond.cy} rx={pond.rx + k * 26} ry={pond.ry + k * 12} fill={gravel} stroke={rake} strokeWidth={2.2} />
      ))}
      <ellipse cx={pond.cx} cy={pond.cy + 3} rx={pond.rx + 12} ry={pond.ry + 10} fill="#85827B" />
      <ellipse cx={pond.cx} cy={pond.cy} rx={pond.rx + 10} ry={pond.ry + 8} fill="#A3A099" />
      <ellipse cx={pond.cx} cy={pond.cy} rx={pond.rx} ry={pond.ry} fill="url(#pond)" />
      <ellipse cx={pond.cx - pond.rx * 0.36} cy={pond.cy - pond.ry * 0.22} rx={pond.rx * 0.28} ry={6} fill="#fff" opacity={0.18} />
      <ellipse cx={pond.cx + pond.rx * 0.48} cy={pond.cy + pond.ry * 0.27} rx={26} ry={9} fill="#7E9C55" />
      {ripples.map((r) => {
        // Start on the pond, toward the pet that shipped.
        const cx = Math.max(pond.cx - pond.rx + 70, Math.min(pond.cx + pond.rx - 70, r.x))
        return (
          <g key={r.key}>
            <ellipse className="ripple" cx={cx} cy={pond.cy} rx={70} ry={22} fill="none" stroke="#fff" strokeWidth={3} />
            <ellipse className="ripple r2" cx={cx} cy={pond.cy} rx={70} ry={22} fill="none" stroke="#fff" strokeWidth={2} />
          </g>
        )
      })}

      {g.moss.map((m, i) => (
        <ellipse key={i} cx={m.x} cy={m.y} rx={m.rx} ry={m.ry} fill="#8EA35C" opacity={sky.night ? 0.5 : 0.9} />
      ))}

      <Lantern {...g.lantern} lit={sky.night} />
      {children}
    </svg>
  )
}

/** A flat stepping stone with rake rings, drawn under a pet. Slightly irregular, seeded by position. */
export function Stone({ x, y, scale, night }: { x: number; y: number; scale: number; night: boolean }) {
  const rx = 82 * scale, ry = 24 * scale
  const rake = night ? '#353943' : '#D3CFC2'
  const gravel = night ? '#2B2E35' : '#E6E4DA'
  const r = rand(Math.round(x * 31 + y))
  const pts = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2
    const k = 0.92 + r() * 0.12
    return [q(x + Math.cos(a) * rx * k), q(y + Math.sin(a) * ry * k)] as const
  })
  // Smooth closed curve through the midpoints, so the stone reads as worn, not cut.
  const mid = (i: number) => {
    const [ax, ay] = pts[i % pts.length]!, [bx, by] = pts[(i + 1) % pts.length]!
    return `${q((ax + bx) / 2)} ${q((ay + by) / 2)}`
  }
  const top = `M${mid(0)} ` + pts.map((_, i) => `Q${pts[(i + 1) % pts.length]!.join(' ')} ${mid(i + 1)}`).join(' ') + ' Z'
  return (
    <g>
      {[2, 1].map((k) => (
        <ellipse key={k} cx={x} cy={y} rx={rx + k * 22} ry={ry + k * 10} fill={gravel} stroke={rake} strokeWidth={2.2} />
      ))}
      <path d={top} transform="translate(0 6)" fill={night ? '#4A4842' : '#85827B'} />
      <path d={top} fill={night ? '#5E5C55' : '#A8A59D'} />
      <ellipse cx={x - rx * 0.3} cy={y - ry * 0.35} rx={rx * 0.35} ry={ry * 0.25} fill="#fff" opacity={0.16} />
    </g>
  )
}
