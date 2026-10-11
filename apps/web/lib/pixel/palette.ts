// Cozy 16-bit palette. Every environment colour has a day, dusk and night variant; the clock
// interpolates between them, which is how the garden relights itself through the day.
const P = {
  sky0: ['#5b8fd1', '#45467f', '#0c1230'],
  sky1: ['#77a7de', '#6f5596', '#141c42'],
  sky2: ['#9cc2e6', '#c06c86', '#1c2752'],
  sky3: ['#cfe3ee', '#f0a878', '#273562'],
  far: ['#93a9c6', '#7d6d9a', '#121a3a'],
  snow: ['#f2f6f9', '#f6d3cb', '#7f8fbb'],
  forest: ['#5e7d55', '#4c4c62', '#14223a'],
  forestHi: ['#789a63', '#64607a', '#1d2d47'],
  plaster: ['#dccaa6', '#c99e88', '#3c394b'],
  plasterLine: ['#f3ecdc', '#e2bcaa', '#4c4860'],
  tile: ['#3f4454', '#372f47', '#1a1c2a'],
  tileHi: ['#5d6375', '#55496a', '#2a2d40'],
  gravel: ['#e2ddcd', '#d6b6a3', '#383b51'],
  rakeD: ['#cdc6b2', '#c19f8f', '#2d3046'],
  rakeL: ['#f2efe5', '#e6cdbd', '#454a63'],
  stone: ['#a09b90', '#8f8083', '#4d4c5e'],
  stoneD: ['#77726a', '#685d65', '#353548'],
  stoneH: ['#c7c2b6', '#b8a6a4', '#66667c'],
  moss: ['#7f9c4f', '#6f7c56', '#2c4639'],
  mossD: ['#617c3c', '#58613f', '#213529'],
  mossH: ['#a3bd67', '#8e9a6a', '#3a5a45'],
  maple: ['#cf4f3c', '#c04a48', '#5a2633'],
  mapleH: ['#e9744a', '#dd6a55', '#78313c'],
  mapleD: ['#9b3330', '#8a3039', '#3c1a26'],
  trunk: ['#4b3529', '#3f2c2d', '#1d1519'],
  water: ['#6aa6c9', '#9b6f97', '#1c2e56'],
  waterD: ['#4c86ad', '#6f5285', '#132143'],
  waterH: ['#c3e3ef', '#f3b98f', '#3e5585'],
  pad: ['#6f9a4c', '#5f7451', '#264233'],
  cloud: ['#ffffff', '#f7c7ae', '#2c3762'],
  cloudD: ['#dfe9f3', '#d99a94', '#222c55'],
  sun: ['#fff1b5', '#ffd27a', '#f1ecd2'],
  bush: ['#5f8a4f', '#57664f', '#1f3a33'],
  bushH: ['#7fa865', '#6f7c63', '#2b4a40'],
  bloom: ['#f2a5c0', '#e895a8', '#7a4f6e'],
} as const

export type Role = keyof typeof P
export type Palette = Record<Role, string>

export const hexToRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const toHex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
export const mix = (a: string, b: string, t: number) => {
  const A = hexToRgb(a), B = hexToRgb(b)
  return toHex(A.map((v, i) => v + (B[i]! - v) * t))
}

// [hour, palette index] keyframes: 0 day, 1 dusk, 2 night
const KEYS: Array<[number, 0 | 1 | 2]> = [[0, 2], [5, 2], [6.2, 1], [7.5, 0], [17, 0], [18.6, 1], [20, 2], [24, 2]]

export interface Phase {
  a: 0 | 1 | 2
  b: 0 | 1 | 2
  t: number
  night: boolean
  /** 0..1, how much dusk light is in the scene. */
  dusk: number
}

export function phaseAt(hour: number): Phase {
  const h = ((hour % 24) + 24) % 24
  let i = 0
  while (i < KEYS.length - 2 && h >= KEYS[i + 1]![0]) i++
  const [h0, a] = KEYS[i]!, [h1, b] = KEYS[i + 1]!
  const t = (h - h0) / (h1 - h0)
  const weight = (k: number) => (a === k ? 1 - t : 0) + (b === k ? t : 0)
  return { a, b, t, night: weight(2) > 0.5, dusk: weight(1) }
}

export function paletteAt(hour: number): Palette {
  const { a, b, t } = phaseAt(hour)
  const out = {} as Palette
  for (const k of Object.keys(P) as Role[]) out[k] = mix(P[k][a], P[k][b], t)
  return out
}

/** Deterministic noise in [0, 1). */
export function hash(x: number, y: number, s = 0): number {
  let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
/** Ordered dithering: true for a fraction `t` of pixels in any 4x4 block. */
export const dither = (x: number, y: number, t: number) => t * 16 > BAYER[y & 3]![x & 3]! + 0.5
