import type { CSSProperties, ReactNode } from 'react'
import type { PetState, Species } from '@burrow/core'

const BODY: Record<Species, { d: string; fy: number; armL: [number, number]; armR: [number, number]; nori?: true }> = {
  mochi: { d: 'M18 97 C14 66 36 40 60 40 C84 40 106 66 102 97 C101 101 19 101 18 97 Z', fy: 72, armL: [25, 84], armR: [95, 84] },
  tofu: { d: 'M31 46 H89 Q100 46 100 57 V91 Q100 100 91 100 H29 Q20 100 20 91 V57 Q20 46 31 46 Z', fy: 70, armL: [22, 82], armR: [98, 82] },
  onigiri: { d: 'M60 33 C67 33 72 38 77 47 L98 84 C104 95 98 100 87 100 L33 100 C22 100 16 95 22 84 L43 47 C48 38 53 33 60 33 Z', fy: 68, armL: [31, 86], armR: [89, 86], nori: true },
}
const INK = '#26241F'
const SPARK = 'M0 -7 Q1.2 -1.2 7 0 Q1.2 1.2 0 7 Q-1.2 1.2 -7 0 Q-1.2 -1.2 0 -7Z'

function star(cx: number, cy: number, r1: number, r2: number, n: number) {
  let p = ''
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = (Math.PI * i) / n - Math.PI / 2
    p += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
  }
  return p + 'Z'
}

function Arm({ at, r, cls, fill }: { at: [number, number]; r: number; cls: string; fill: string }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <g className={`arm ${cls}`} style={{ '--r': `${r}deg` } as CSSProperties}>
        <rect x={-5} y={-3} width={10} height={17} rx={5} fill={fill} />
      </g>
    </g>
  )
}

export interface PetProps {
  species: Species
  state: PetState
  color: string
  /** Placement when nested inside a parent SVG. */
  x?: number
  y?: number
  size?: number
}

export function Pet({ species, state, color, x, y, size = 120 }: PetProps) {
  const b = BODY[species]
  const fy = b.fy - (state === 'work' ? 7 : 0)
  const my = fy + 7
  const clipId = `clip-${species}`
  const dot = (cx: number) => <ellipse key={cx} cx={cx} cy={fy} rx={3.3} ry={state === 'wave' ? 4.2 : 3.6} fill={INK} />
  const arc = (d: string) => <path d={d} stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />

  let eyes: ReactNode = null
  if (state === 'idle' || state === 'wave') eyes = <g className="eyes">{dot(49)}{dot(71)}</g>
  if (state === 'work') eyes = <g className="eyes"><ellipse cx={49} cy={fy + 1.5} rx={3.2} ry={2.6} fill={INK} /><ellipse cx={71} cy={fy + 1.5} rx={3.2} ry={2.6} fill={INK} /></g>
  if (state === 'sleep') eyes = arc(`M44.5 ${fy} q4.5 3.6 9 0 M66.5 ${fy} q4.5 3.6 9 0`)
  if (state === 'eat' || state === 'cheer') eyes = arc(`M44.5 ${fy + 1.5} q4.5 -5.5 9 0 M66.5 ${fy + 1.5} q4.5 -5.5 9 0`)

  let mouth: ReactNode = null
  if (state === 'idle') mouth = arc(`M56 ${my} q4 3.2 8 0`)
  if (state === 'eat') mouth = <><ellipse className="mo" cx={60} cy={my + 1} rx={4.2} ry={4.6} fill={INK} /><path className="mc" d={`M55.5 ${my} q2.25 2.6 4.5 0 q2.25 2.6 4.5 0`} stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" /></>
  if (state === 'wave') mouth = <path d={`M55.5 ${my - 1} q4.5 7 9 0 z`} fill={INK} />
  if (state === 'sleep') mouth = <ellipse cx={60} cy={my + 1} rx={2} ry={2.3} fill={INK} opacity={0.85} />
  if (state === 'cheer') mouth = <><path d={`M53.5 ${my - 1.5} q6.5 11 13 0 z`} fill={INK} /><path d={`M56.5 ${my + 3.2} q3.5 2.6 7 0`} stroke="#FF8FA3" strokeWidth={2.4} fill="none" strokeLinecap="round" /></>

  const arms: Array<{ at: [number, number]; r: number; cls: string }> = []
  if (state === 'wave') arms.push({ at: b.armR, r: -140, cls: 'arm-wave' }, { at: b.armL, r: 22, cls: '' })
  if (state === 'cheer') arms.push({ at: b.armR, r: -150, cls: 'arm-up' }, { at: b.armL, r: 150, cls: 'arm-up' })

  return (
    <svg className={`pet st-${state}`} viewBox="0 0 120 120" x={x} y={y} width={size} height={size} aria-hidden="true">
      <defs>
        <clipPath id={clipId}><path d={b.d} /></clipPath>
        <radialGradient id="petLight" cx=".34" cy=".28" r=".55"><stop offset="0" stopColor="#fff" stopOpacity=".42" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <linearGradient id="petShade" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".16" /></linearGradient>
      </defs>
      <ellipse className="shadow" cx={60} cy={101.5} rx={34} ry={3.6} fill="rgba(35,30,20,.24)" />
      {state === 'eat' && (
        <>
          <g className="item"><path d={star(60, my + 1, 6.5, 4.2, 7)} fill="#F0C64E" stroke="#F0C64E" strokeWidth={2.2} strokeLinejoin="round" /></g>
          <circle className="crumb" cx={52} cy={my + 4} r={1.8} fill="#F0C64E" />
          <circle className="crumb c2" cx={68} cy={my + 4} r={1.6} fill="#F0C64E" />
        </>
      )}
      {state === 'wave' && (
        <g className="bubble">
          <path d="M86 6 h20 a8 8 0 0 1 8 8 v14 a8 8 0 0 1 -8 8 h-12 l-7 7 l1 -7 h-2 a8 8 0 0 1 -8 -8 v-14 a8 8 0 0 1 8 -8z" fill="rgba(255,255,255,.86)" stroke="rgba(255,255,255,.95)" strokeWidth={1.2} />
          <rect x={94} y={12} width={4.4} height={13} rx={2.2} fill={INK} />
          <circle cx={96.2} cy={30} r={2.5} fill={INK} />
        </g>
      )}
      {state === 'sleep' && (
        <>
          <text className="z" x={82} y={44} fontSize={17} fill={INK}>z</text>
          <text className="z z2" x={90} y={36} fontSize={13} fill={INK}>z</text>
          <text className="z z3" x={80} y={30} fontSize={20} fill={INK}>z</text>
        </>
      )}
      {state === 'cheer' && (
        <>
          <path className="spark" d={SPARK} transform="translate(18 38)" fill="#F0C64E" />
          <path className="spark s2" d={SPARK} transform="translate(104 30) scale(.8)" fill="#EFA9BC" />
          <path className="spark s3" d={SPARK} transform="translate(98 62) scale(.6)" fill="#98B062" />
        </>
      )}
      <g className="hop">
        <g className="squash">
          <path d={b.d} fill={color} />
          <g clipPath={`url(#${clipId})`}>
            {b.nori && <path d="M47 86 H73 V100 H47 Z" fill="#2F3A2B" />}
            <path d={b.d} fill="url(#petShade)" />
            <path d={b.d} fill="url(#petLight)" />
          </g>
          {arms.map((a) => <Arm key={a.cls + a.r} {...a} fill={color} />)}
          {state !== 'work' && (
            <>
              <ellipse cx={41} cy={fy + 6} rx={4.6} ry={2.6} fill="#E77C93" opacity={0.55} />
              <ellipse cx={79} cy={fy + 6} rx={4.6} ry={2.6} fill="#E77C93" opacity={0.55} />
            </>
          )}
          {eyes}
          {mouth}
        </g>
      </g>
      {state === 'work' && (
        <>
          <rect className="glow" x={38} y={fy - 10} width={44} height={20} rx={10} fill="#CDE7FF" opacity={0.28} />
          <rect x={34} y={72} width={52} height={29} rx={3.5} fill="#DCE0E6" />
          <circle cx={60} cy={86} r={4} fill="rgba(0,0,0,.18)" />
          <path d="M28 101 H92 L88 105 H32 Z" fill="#9AA1AC" />
          <ellipse className="hand" cx={45} cy={72} rx={5} ry={3.6} fill={color} />
          <ellipse className="hand h2" cx={75} cy={72} rx={5} ry={3.6} fill={color} />
        </>
      )}
    </svg>
  )
}
