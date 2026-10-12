import { DEFAULT_COLOR, isPetColor, type PetColor, type PetState, type Species, type Stage } from '@burrow/core'

// Pets are rasterised from simple shapes into a 32x32 grid of colour codes, then shaded,
// outlined, given a face and props. Pure: the canvas side only maps codes to colours.
export const GRID = 32
const CX = 16
const BOT = 28

export const C = { E: 0, O: 1, B: 2, H: 3, S: 4, F: 5, W: 6, P: 7, N: 8, L1: 9, L2: 10, A: 11, K1: 12, K2: 13, Y: 14, Z: 15, R: 16, D: 17, V: 18, G: 19, Q: 20 } as const
type Code = (typeof C)[keyof typeof C]

export const FRAMES: Record<PetState, number> = { idle: 4, eat: 4, wave: 2, work: 2, sleep: 3, cheer: 4 }
export const FPS: Record<PetState, number> = { idle: 3, eat: 5, wave: 4, work: 6, sleep: 1.5, cheer: 8 }

export const PET_INK = '#2a2033'
/** Body tones for each pet colour: fixed, saturated, never relit by the clock. */
export const PET_TONES: Record<PetColor, { base: string; hi: string; shade: string }> = {
  sakura: { base: '#f4a3bc', hi: '#fcd2df', shade: '#d77898' },
  matcha: { base: '#9fc36a', hi: '#c8e196', shade: '#729744' },
  rice: { base: '#f7f2e6', hi: '#ffffff', shade: '#d6cdb9' },
  yuzu: { base: '#f5c94f', hi: '#fbe59a', shade: '#d49a2e' },
  sora: { base: '#a6cbef', hi: '#d3e7fb', shade: '#7099d1' },
  fuji: { base: '#c3aee6', hi: '#e3d7f7', shade: '#9a80ca' },
  kinako: { base: '#e2ac72', hi: '#f4d3a6', shade: '#bd864c' },
}

/** The member's own colour, or the species default if it is missing or unknown. */
export const toneOf = (species: Species, color: unknown): PetColor => (isPetColor(color) ? color : DEFAULT_COLOR[species])

/** Colour for each code, for a given pet colour. */
export function colorsFor(color: PetColor): Record<number, string> {
  const t = PET_TONES[color]
  return {
    [C.O]: PET_INK, [C.B]: t.base, [C.H]: t.hi, [C.S]: t.shade, [C.F]: PET_INK, [C.W]: '#ffffff', [C.P]: '#ff8fa8',
    [C.N]: '#2f3b30', [C.L1]: '#dfe4ec', [C.L2]: '#9aa3b2', [C.A]: '#e2383f', [C.K1]: '#f0c64e', [C.K2]: '#7fc4e8',
    [C.Y]: '#ffd34f', [C.Z]: '#ffffff', [C.R]: '#ff8fa3', [C.D]: '#5c3030', [C.V]: '#86c46d', [C.G]: '#c98a3a', [C.Q]: '#fff0f5',
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
  // three dumplings on a skewer, a pixel apart so the stick shows between them; the middle one carries the face
  dango: (x, y) => {
    const ball = (cx: number, cy: number, r: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    return y <= BOT && (ball(CX, 22.2, 5.8) || ball(CX - 11, 24.2, 3.8) || ball(CX + 11, 24.2, 3.8))
  },
  // a fish-shaped cake facing left: a round body, a fanned tail and a small top fin
  taiyaki: (x, y) => {
    if (y > BOT) return false
    const body = ((x - CX + 1) / 10.5) ** 2 + ((y - 21.5) / 6.6) ** 2 <= 1
    const tail = x >= 24 && x <= 30 && Math.abs(y - 21.5) <= Math.min(6, (x - 22.5) * 1.15)
    const fin = y >= 13.5 && y < 15.5 && x >= 12 && x <= 19
    return body || tail || fin
  },
  // two pancakes; the anko between them is painted after the shape
  dorayaki: (x, y) => y <= BOT && (((x - CX) / 12.2) ** 2 + ((y - 21) / 5.6) ** 2 <= 1 || ((x - CX) / 12) ** 2 + ((y - 26) / 2.6) ** 2 <= 1),
}
const FACE_Y: Record<Species, number> = { mochi: 21, tofu: 20, onigiri: 20, dango: 20, taiyaki: 20, dorayaki: 19 }

/** A baby is the grown silhouette at this scale about the feet. */
const BABY = 0.78
/** Where a baby's face sits (it rides a row lower when the body squashes); dango's small middle ball needs closer eyes. */
const BABY_FACE: Record<Species, { y: number; narrow?: boolean }> = { mochi: { y: 21 }, tofu: { y: 20 }, onigiri: { y: 20 }, dango: { y: 21, narrow: true }, taiyaki: { y: 20 }, dorayaki: { y: 20 } }

/**
 * Each evolved form's signature detail, drawn over the outline at the top of the head (`dx` from centre,
 * bottom row resting `sink` rows into the head) and outlined itself.
 */
const CROWNS: Record<Species, { sprite: string[]; dx: number; sink: number; map: Record<string, Code> }> = {
  mochi: { sprite: ['.QQ.QQ.', 'QQQQQQQ', '.QQYQQ.', 'QQQQQQQ', '.QQ.QQ.'], dx: 4, sink: 2, map: { Q: C.Q, Y: C.Y } }, // a sakura blossom
  tofu: { sprite: ['V.....V', 'VV...VV', '.VV.VV.', '..VVV..', '..VVV..', '...V...'], dx: -4, sink: 1, map: { V: C.V } }, // a green onion sprig
  onigiri: { sprite: ['..V..', '.AAA.', 'ARRAA', 'AAAAA', '.AAA.'], dx: 0, sink: 2, map: { A: C.A, R: C.R, V: C.V } }, // an umeboshi plum
  dango: { sprite: ['.GGG.', 'GKKGG', 'GGGGG', '.GGG.'], dx: 0, sink: 2, map: { G: C.G, K: C.K1 } }, // a dollop of mitarashi glaze
  taiyaki: { sprite: ['K..K..K', 'KK.KK.KK', 'KKKKKKKK'], dx: -1, sink: 1, map: { K: C.K1 } }, // a golden crown fin
  dorayaki: { sprite: ['...V...', '..DDD..', '.DDDDD.', 'DDKDDDD', 'DKDDDDD', '.DDDDD.'], dx: 0, sink: 2, map: { D: C.D, K: C.K1, V: C.V } }, // a chestnut
}

/** Every drawn pixel in ink: the catalog's undiscovered forms. */
export const silhouette = (g: Code[][]): Code[][] => g.map((r) => r.map((v) => (v === C.E ? C.E : C.O)))

/**
 * The pixel grid for one frame. `quiet` is the work state when the run has gone silent
 * (maybe interrupted): the pet dozes off at its laptop.
 */
export function petGrid(species: Species, state: PetState, frame: number, quiet = false, stage: Stage = 'grown'): Code[][] {
  const k = stage === 'baby' ? BABY : 1
  // scale an x offset from the centre, so babies keep eyes, arms and feet on their smaller body
  const kx = (x: number) => Math.round(CX + (x - CX) * k)
  let sx = 1, sy = 1, dy = 0
  let arm: 'out' | 'up' | null = null, armL: 'up' | null = null
  if ((state === 'idle' && frame % 4 === 1) || (state === 'sleep' && frame % 3 === 1)) { sx = 1.06; sy = 0.92 }
  if (state === 'eat' && frame === 2) { sx = 1.12; sy = 0.86 }
  if (state === 'work' && frame === 1) { sx = 1.04; sy = 0.94 } // even busy pets breathe
  if (state === 'cheer') {
    if (frame === 0) { sx = 1.12; sy = 0.86 }
    dy = [0, -3, -5, -2][frame] ?? 0
    if (frame > 0) { arm = 'up'; armL = 'up' }
  }
  if (state === 'wave') arm = frame % 2 ? 'up' : 'out'

  const shape = SHAPES[species]
  const squash = sy
  sx *= k
  sy *= k
  const g: Code[][] = Array.from({ length: GRID }, () => new Array<Code>(GRID).fill(C.E))
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) if (shape(CX + (x - CX) / sx, BOT - (BOT - (y - dy)) / sy)) g[y]![x] = C.B
  const faceY = k === 1 ? FACE_Y[species] : BABY_FACE[species].y + Math.round((1 - squash) * (BOT - BABY_FACE[species].y))

  // Arms are part of the silhouette, so they get outlined too.
  const nub = (pts: Array<[number, number]>) => pts.forEach(([x, y]) => { if (g[y + dy] && x >= 0 && x < GRID) g[y + dy]![x] = C.B })
  const ay = faceY + 3
  const arms = (pts: Array<[number, number]>) => nub(pts.map(([x, y]) => [kx(x), y]))
  if (arm === 'out') arms([[27, ay - 1], [28, ay - 2], [27, ay - 2], [28, ay - 3]])
  if (arm === 'up') arms([[26, ay - 4], [27, ay - 5], [27, ay - 6], [28, ay - 7], [27, ay - 4]])
  if (armL === 'up') arms([[6, ay - 4], [5, ay - 5], [5, ay - 6], [4, ay - 7], [5, ay - 4]])
  // the nori band sits low, leaving rice between it and the face
  if (species === 'onigiri') for (let y = BOT - 2; y <= BOT; y++) for (let x = kx(12); x <= kx(20); x++) if (g[y + dy]?.[x] === C.B) g[y + dy]![x] = C.N
  // dorayaki: the anko shows as a dark band between the pancakes, inside the outline
  if (species === 'dorayaki') {
    for (const y of k === 1 ? [BOT - 3, BOT - 2] : [BOT - 2]) {
      const row = g[y + dy]?.slice()
      if (row) for (let x = 1; x < GRID - 1; x++) if (row[x] === C.B && row[x - 1] === C.B && row[x + 1] === C.B) g[y + dy]![x] = C.D
    }
  }

  // Shading reads a snapshot of the silhouette, so a changed pixel never cascades.
  const mask = g.map((r) => r.map((v) => v === C.B || v === C.N || v === C.D))
  const body = (x: number, y: number) => !!mask[y]?.[x]
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      if (g[y]![x] !== C.B) continue
      if (species === 'taiyaki' && x > CX + 4 && x < 25 && (x + y) % 4 === 0 && body(x, y - 1) && body(x, y + 1)) { g[y]![x] = C.S; continue } // scales
      if (!body(x, y + 1) || !body(x, y + 2) || (!body(x + 1, y) && x > CX)) g[y]![x] = C.S
      else if ((!body(x, y - 1) && x <= CX + 1) || (!body(x - 1, y) && y < BOT - 4)) g[y]![x] = C.H
    }
  const fy = faceY + dy
  for (const hx of [CX - 4, CX - 3]) if (g[fy - 5]?.[hx] === C.B) g[fy - 5]![hx] = C.H

  const set = (x: number, y: number, v: Code) => { if (g[y] && x >= 0 && x < GRID) g[y]![x] = v }
  // tiny feet when grounded
  if (dy === 0) for (const fx of [CX - 5, CX - 4, CX + 3, CX + 4]) set(kx(fx), BOT + 1, C.O)

  // face
  const dozing = state === 'work' && quiet
  const happy = (state === 'eat' && frame !== 1) || state === 'cheer'
  const closed = state === 'sleep' || dozing || (state === 'idle' && frame === 3)
  const eye = (x: number) => {
    if (closed) { set(x, fy + 1, C.F); set(x + 1, fy + 1, C.F) }
    else if (happy) { set(x, fy + 1, C.F); set(x + 1, fy, C.F); set(x + 2, fy + 1, C.F) }
    else { set(x, fy, C.W); set(x + 1, fy, C.F); set(x, fy + 1, C.F); set(x + 1, fy + 1, C.F) }
  }
  const lx = k === 1 ? CX - 5 : BABY_FACE[species].narrow ? CX - 3 : CX - 4, rx = k === 1 ? CX + 3 : BABY_FACE[species].narrow ? CX + 1 : CX + 2
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
  // A z with a dark outline reads over water, gravel or sky alike.
  const putOutlined = (sprite: string[], ox: number, oy: number) => {
    sprite.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (out[oy + y + b]?.[ox + x + a] === C.E) out[oy + y + b]![ox + x + a] = C.O
    }))
    put(sprite, ox, oy, { Z: C.Z })
  }
  const ZED = ['ZZZ', '..Z', '.Z.', 'Z..', 'ZZZ']
  if (state === 'work') {
    // A low lid (4 rows) keeps a band of body colour between the eyes and the laptop.
    // the lid's top edge is grey, not ink, so it never reads as a wide mouth from across the room
    put(['2222222222222'.slice(1), 'O1111221111O', 'O1111111111O', 'OOOOOOOOOOOO', '.O22222222O.'], CX - 6, BOT - 3, { O: C.O, 1: C.L1, 2: C.L2 })
    const paw = dozing ? 0 : frame % 2
    // paws tap the lid's top edge, between the blush and the mouth
    put(['SS'], CX - 4, BOT - 3 - paw, { S: C.S })
    put(['SS'], CX + 3, BOT - 3 - (dozing ? 0 : 1 - paw), { S: C.S })
    if (dozing) putOutlined(ZED, 24, 6 - (frame % 2))
  }
  if (state === 'wave') put(['.OOOO.', 'OWWAWO', 'OWWAWO', 'OWWWWO', 'OWWAWO', '.OOOO.', '.O....'], 23, 3 + (frame % 2) + (k === 1 ? 0 : 3), { O: C.O, W: C.W, A: C.A })
  if (state === 'eat' && frame === 0) put(['.K.', 'KYK', '.K.'], CX - 1, fy - 1, { K: C.K1, Y: C.K2 })
  if (state === 'eat' && frame === 2) { set(CX - 4, my + 2, C.K1); set(CX + 4, my + 1, C.K2) }
  if (state === 'sleep') { const o = frame % 3; putOutlined(ZED, 23 + o, 6 - o * 2) }
  if (state === 'cheer') {
    const sp = ['..Y..', '..Y..', 'YY.YY', '..Y..', '..Y..']
    put(sp, frame % 2 ? 2 : 4, frame % 2 ? 6 : 3, { Y: C.Y })
    put(sp, 25, frame % 2 ? 3 : 8, { Y: C.Y })
  }
  if (stage === 'evolved') {
    // the detail rests on the head's actual top, so it rides along with squashes and jumps
    const crown = CROWNS[species]
    const ox = CX + crown.dx - Math.floor(crown.sprite[0]!.length / 2)
    const cols = crown.sprite[0]!.length
    const top = Math.min(...Array.from({ length: cols }, (_, i) => mask.findIndex((r) => r[ox + i])).filter((y) => y >= 0))
    const oy = top - crown.sprite.length + crown.sink
    crown.sprite.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (out[oy + y + b]?.[ox + x + a] === C.E) out[oy + y + b]![ox + x + a] = C.O
    }))
    put(crown.sprite, ox, oy, crown.map)
    // two still sparkles mark an evolved pet at a glance (cheering pets already have their own)
    if (state !== 'cheer') for (const [x, y] of [[kx(4), 12], [kx(27), 16]] as const) if (out[y]?.[x] === C.E) out[y]![x] = C.Y
  }
  // dango: the skewer shows between the dumplings and pokes out at both ends
  if (species === 'dango') {
    const sy = Math.round(BOT - (BOT - 24) * k) + dy
    for (let x = 0; x < GRID; x++) if (out[sy]?.[x] === C.E || out[sy]?.[x] === C.O) out[sy]![x] = C.L2
  }
  return out
}
