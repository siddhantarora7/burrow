import type { PetState, Species } from '@burrow/core'

// Pets are rasterised from simple shapes into a 32x32 grid of colour codes, then shaded,
// outlined, given a face and props. Pure: the canvas side only maps codes to colours.
export const GRID = 32
const CX = 16
const BOT = 28

export const C = { E: 0, O: 1, B: 2, H: 3, S: 4, F: 5, W: 6, P: 7, N: 8, L1: 9, L2: 10, A: 11, K1: 12, K2: 13, Y: 14, Z: 15, R: 16 } as const
type Code = (typeof C)[keyof typeof C]

export const FRAMES: Record<PetState, number> = { idle: 4, eat: 4, wave: 2, work: 2, sleep: 3, cheer: 4 }
export const FPS: Record<PetState, number> = { idle: 3, eat: 5, wave: 4, work: 6, sleep: 1.5, cheer: 8 }

export const PET_INK = '#2a2033'
export const PET_TONES: Record<Species, { base: string; hi: string; shade: string }> = {
  mochi: { base: '#f4a3bc', hi: '#fcd2df', shade: '#d77898' },
  tofu: { base: '#9fc36a', hi: '#c8e196', shade: '#729744' },
  onigiri: { base: '#f7f2e6', hi: '#ffffff', shade: '#d6cdb9' },
}

/** Colour for each code, for a given species. */
export function colorsFor(species: Species): Record<number, string> {
  const t = PET_TONES[species]
  return {
    [C.O]: PET_INK, [C.B]: t.base, [C.H]: t.hi, [C.S]: t.shade, [C.F]: PET_INK, [C.W]: '#ffffff', [C.P]: '#ff8fa8',
    [C.N]: '#2f3b30', [C.L1]: '#dfe4ec', [C.L2]: '#9aa3b2', [C.A]: '#e2383f', [C.K1]: '#f0c64e', [C.K2]: '#7fc4e8',
    [C.Y]: '#ffd34f', [C.Z]: '#ffffff', [C.R]: '#ff8fa3',
  }
}

const SHAPES: Record<Species, (x: number, y: number) => boolean> = {
  mochi: (x, y) => y <= BOT && y >= 14 && ((x - CX) / 10.5) ** 2 + ((y - BOT) / 14) ** 2 <= 1,
  tofu: (x, y) => {
    if (x < 6 || x > 26 || y < 14 || y > BOT) return false
    const r = 3, cx = Math.max(6 + r, Math.min(26 - r, x)), cy = Math.max(14 + r, Math.min(BOT - r, y))
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5
  },
  onigiri: (x, y) => {
    if (y > BOT || y < 11) return false
    const half = (y - 11) * 0.72 + 1.2
    if (Math.abs(x - CX) > half) return false
    if (y >= BOT - 1 && Math.abs(x - CX) > half - 2) return false
    return !(y < 13 && Math.abs(x - CX) > 1)
  },
}
const FACE_Y: Record<Species, number> = { mochi: 21, tofu: 20, onigiri: 21 }

/**
 * The pixel grid for one frame. `quiet` is the work state when the run has gone silent
 * (maybe interrupted): the pet dozes off at its laptop.
 */
export function petGrid(species: Species, state: PetState, frame: number, quiet = false): Code[][] {
  let sx = 1, sy = 1, dy = 0
  let arm: 'out' | 'up' | null = null, armL: 'up' | null = null
  if ((state === 'idle' && frame % 4 === 1) || (state === 'sleep' && frame % 3 === 1)) { sx = 1.06; sy = 0.92 }
  if (state === 'eat' && frame === 2) { sx = 1.12; sy = 0.86 }
  if (state === 'cheer') {
    if (frame === 0) { sx = 1.12; sy = 0.86 }
    dy = [0, -3, -5, -2][frame] ?? 0
    if (frame > 0) { arm = 'up'; armL = 'up' }
  }
  if (state === 'wave') arm = frame % 2 ? 'up' : 'out'

  const shape = SHAPES[species]
  const g: Code[][] = Array.from({ length: GRID }, () => new Array<Code>(GRID).fill(C.E))
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) if (shape(CX + (x - CX) / sx, BOT - (BOT - (y - dy)) / sy)) g[y]![x] = C.B

  // Arms are part of the silhouette, so they get outlined too.
  const nub = (pts: Array<[number, number]>) => pts.forEach(([x, y]) => { if (g[y + dy] && x >= 0 && x < GRID) g[y + dy]![x] = C.B })
  const ay = FACE_Y[species] + 3
  if (arm === 'out') nub([[27, ay - 1], [28, ay - 2], [27, ay - 2], [28, ay - 3]])
  if (arm === 'up') nub([[26, ay - 4], [27, ay - 5], [27, ay - 6], [28, ay - 7], [27, ay - 4]])
  if (armL === 'up') nub([[6, ay - 4], [5, ay - 5], [5, ay - 6], [4, ay - 7], [5, ay - 4]])
  if (species === 'onigiri') for (let y = 23; y <= BOT; y++) for (let x = 12; x <= 20; x++) if (g[y + dy]?.[x] === C.B) g[y + dy]![x] = C.N

  // Shading reads a snapshot of the silhouette, so a changed pixel never cascades.
  const mask = g.map((r) => r.map((v) => v === C.B || v === C.N))
  const body = (x: number, y: number) => !!mask[y]?.[x]
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      if (g[y]![x] !== C.B) continue
      if (!body(x, y + 1) || !body(x, y + 2) || (!body(x + 1, y) && x > CX)) g[y]![x] = C.S
      else if ((!body(x, y - 1) && x <= CX + 1) || (!body(x - 1, y) && y < BOT - 4)) g[y]![x] = C.H
    }
  const fy = FACE_Y[species] + dy
  for (const hx of [CX - 4, CX - 3]) if (g[fy - 5]?.[hx] === C.B) g[fy - 5]![hx] = C.H

  const set = (x: number, y: number, v: Code) => { if (g[y] && x >= 0 && x < GRID) g[y]![x] = v }
  // tiny feet when grounded
  if (dy === 0) for (const fx of [CX - 5, CX - 4, CX + 3, CX + 4]) set(fx, BOT + 1, C.O)

  // face
  const dozing = state === 'work' && quiet
  const happy = (state === 'eat' && frame !== 1) || state === 'cheer'
  const closed = state === 'sleep' || dozing || (state === 'idle' && frame === 3)
  const eye = (x: number) => {
    if (closed) { set(x, fy + 1, C.F); set(x + 1, fy + 1, C.F) }
    else if (happy) { set(x, fy + 1, C.F); set(x + 1, fy, C.F); set(x + 2, fy + 1, C.F) }
    else { set(x, fy, C.W); set(x + 1, fy, C.F); set(x, fy + 1, C.F); set(x + 1, fy + 1, C.F) }
  }
  const lx = CX - 5, rx = CX + 3
  eye(happy ? lx - 1 : lx)
  eye(rx)
  for (const [bx, by] of [[lx - 2, fy + 3], [lx - 1, fy + 3], [rx + 2, fy + 3], [rx + 3, fy + 3]] as const) if (g[by]?.[bx] !== C.E) set(bx, by, C.P)
  const my = fy + 3
  if (state === 'idle' || (state === 'work' && !dozing)) { set(CX - 1, my, C.F); set(CX, my + 1, C.F); set(CX + 1, my, C.F) }
  if (dozing || state === 'sleep') set(CX, my, C.F)
  if (state === 'wave' || (state === 'eat' && frame === 1)) for (const [mx, mmy] of [[CX - 1, my], [CX, my], [CX - 1, my + 1], [CX, my + 1]] as const) set(mx, mmy, C.F)
  if (state === 'eat' && frame !== 1) { set(CX - 1, my, C.F); set(CX, my, C.F) }
  if (state === 'cheer') { for (let x = CX - 2; x <= CX + 1; x++) set(x, my, C.F); set(CX - 1, my + 1, C.R); set(CX, my + 1, C.R) }

  // outline: every empty pixel touching the silhouette
  const out = g.map((r) => r.slice())
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      if (g[y]![x] !== C.E) continue
      const touches = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([a, b]) => {
        const v = g[y + b]?.[x + a]
        return v !== undefined && v !== C.E && v !== C.O
      })
      if (touches) out[y]![x] = C.O
    }

  // props, drawn over the outline
  const put = (sprite: string[], ox: number, oy: number, map: Record<string, Code>) =>
    sprite.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && out[oy + y] && ox + x >= 0 && ox + x < GRID) out[oy + y]![ox + x] = map[ch]! }))
  if (state === 'work') {
    put(['OOOOOOOOOOOO', 'O1111111111O', 'O1111221111O', 'O1111111111O', 'OOOOOOOOOOOO', '.O22222222O.'], CX - 6, BOT - 5, { O: C.O, 1: C.L1, 2: C.L2 })
    const paw = dozing ? 0 : frame % 2
    // paws rest on the lid's corners, clear of the eyes
    put(['SS'], CX - 7, BOT - 6 - paw, { S: C.S })
    put(['SS'], CX + 5, BOT - 6 - (dozing ? 0 : 1 - paw), { S: C.S })
    if (dozing) put(['ZZ', '.Z', 'ZZ'], 24, 9 - (frame % 2), { Z: C.Z })
  }
  if (state === 'wave') put(['.OOOO.', 'OWWAWO', 'OWWAWO', 'OWWWWO', 'OWWAWO', '.OOOO.', '.O....'], 23, 3 + (frame % 2), { O: C.O, W: C.W, A: C.A })
  if (state === 'eat' && frame === 0) put(['.K.', 'KYK', '.K.'], CX - 1, fy - 1, { K: C.K1, Y: C.K2 })
  if (state === 'eat' && frame === 2) { set(CX - 4, my + 2, C.K1); set(CX + 4, my + 1, C.K2) }
  if (state === 'sleep') { const o = frame % 3; put(['ZZZ', '..Z', '.Z.', 'Z..', 'ZZZ'], 23 + o, 6 - o * 2, { Z: C.Z }) }
  if (state === 'cheer') {
    const sp = ['..Y..', '..Y..', 'YY.YY', '..Y..', '..Y..']
    put(sp, frame % 2 ? 2 : 4, frame % 2 ? 6 : 3, { Y: C.Y })
    put(sp, 25, frame % 2 ? 3 : 8, { Y: C.Y })
  }
  return out
}
