import type { GardenLayout } from '@burrow/core'
import { dither, hash, hexToRgb, mix, type Palette, type Phase } from './palette'

/** An RGBA pixel buffer the size of the scene; the canvas side wraps it in ImageData. */
export interface Buffer {
  w: number
  h: number
  data: Uint8ClampedArray<ArrayBuffer>
}

export const makeBuffer = (w: number, h: number): Buffer => ({ w, h, data: new Uint8ClampedArray(w * h * 4) })

function px(b: Buffer, x: number, y: number, color: string) {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return
  const [r, g, bl] = hexToRgb(color)
  const i = (y * b.w + x) * 4
  b.data[i] = r
  b.data[i + 1] = g
  b.data[i + 2] = bl
  b.data[i + 3] = 255
}

export const sunPosition = (L: GardenLayout) => ({ x: Math.round(L.width * (L.portrait ? 0.2 : 0.18)), y: Math.round(L.horizon * 0.34) })

/** Sky: four colour bands dithered into each other, plus the sun or a crescent moon. */
export function bakeSky(L: GardenLayout, pal: Palette, phase: Phase): Buffer {
  const b = makeBuffer(L.width, L.height)
  const bands = [pal.sky0, pal.sky1, pal.sky2, pal.sky3]
  for (let y = 0; y < L.horizon + 4; y++) {
    const f = (y / (L.horizon + 4)) * 3, i = Math.floor(f), t = f - i
    for (let x = 0; x < L.width; x++) px(b, x, y, dither(x, y, t) ? bands[Math.min(3, i + 1)]! : bands[i]!)
  }
  const s = sunPosition(L)
  for (let y = -12; y <= 12; y++)
    for (let x = -12; x <= 12; x++) {
      const d = Math.hypot(x, y)
      if (phase.night) {
        if (d <= 5 && Math.hypot(x - 2, y + 1) > 4.2) px(b, s.x + x, s.y + y, pal.sun)
      } else if (d <= 6) px(b, s.x + x, s.y + y, pal.sun)
      else if (d <= 10 && dither(x + s.x, y + s.y, ((10 - d) / 4) * 0.5)) px(b, s.x + x, s.y + y, mix(pal.sun, pal.sky1, 0.45))
    }
  return b
}

function blob(b: Buffer, cx: number, cy: number, rx: number, ry: number, base: string, hi: string, dark: string, seed: number, flowers?: string) {
  for (let y = cy - ry - 2; y <= cy + ry + 2; y++)
    for (let x = cx - rx - 2; x <= cx + rx + 2; x++) {
      const n = hash(Math.floor(x / 2), Math.floor(y / 2), seed)
      const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (e > 0.75 + n * 0.5) continue
      let c = base
      if (y < cy - ry * 0.3 && x < cx + rx * 0.3) c = hi
      if (y > cy + ry * 0.4 || e > 0.7 + n * 0.3) c = dark
      if (c === base && hash(x, y, seed + 3) > 0.82) c = (x + y) % 2 ? hi : dark
      if (flowers && hash(x, y, seed + 7) > 0.86) c = flowers
      px(b, x, y, c)
    }
}

const LANTERN = [
  '.......K.......',
  '......KSK......',
  '.......K.......',
  '....KKKKKKK....',
  '..KKSSSSSSSKK..',
  'KKSSSSHHHSSSSKK',
  'K.KDDDDDDDDDK.K',
  '....KSSSSSK....',
  '....KSLLLSK....',
  '....KSLLLSK....',
  '....KSLLLSK....',
  '....KSSSSSK....',
  '...KDDDDDDDK...',
  '.....KSSSK.....',
  '.....KSHSK.....',
  '.....KSHSK.....',
  '.....KSHSK.....',
  '.....KSHSK.....',
  '.....KSSSK.....',
  '....KDDDDDK....',
  '...KSSSSSSSK...',
  '..KSSSHHSSSSK..',
  '..KDDDDDDDDDK..',
]

/** Everything in front of the sky that never moves: mountains, wall, maple, raked gravel, pond, stones, lantern. */
export function bakeGround(L: GardenLayout, pal: Palette, phase: Phase): Buffer {
  const b = makeBuffer(L.width, L.height)
  const W = L.width, H = L.height, hz = L.horizon
  // far mountain
  for (let x = 0; x < W; x++) {
    const dx = Math.abs(x - L.fuji.x)
    const top = L.fuji.peak + Math.pow(dx / 78, 0.72) * (hz - L.fuji.peak) + (dx < 6 ? 1 : 0)
    for (let y = Math.max(0, Math.floor(top)); y < hz + 2; y++) {
      const snowLine = L.fuji.peak + 9 + Math.round(hash(x, 7) * 3) + (dx % 5 === 0 ? 2 : 0)
      px(b, x, y, y < snowLine && dx < 30 ? pal.snow : pal.far)
    }
  }
  // forest band behind the wall
  for (let x = 0; x < W; x++) {
    const top = hz - 7 - Math.round(Math.abs(Math.sin(x / 5.3)) * 4 + hash(x, 3) * 2)
    for (let y = top; y < hz + 2; y++) px(b, x, y, y <= top + 1 && x % 7 < 3 ? pal.forestHi : pal.forest)
  }
  // wall: tiled cap, plaster with white lines, stone footing
  for (let x = 0; x < W; x++) {
    for (let y = hz - 4; y <= hz; y++) px(b, x, y, y === hz - 4 || x % 4 === 0 ? pal.tileHi : pal.tile)
    const eave = x % 4 === 1 || x % 4 === 2
    if (eave) px(b, x, hz + 1, pal.tile)
    for (let y = hz + (eave ? 2 : 1); y < hz + 14; y++) px(b, x, y, pal.plaster)
    px(b, x, hz + 6, pal.plasterLine)
    px(b, x, hz + 9, pal.plasterLine)
    for (let y = hz + 14; y < hz + 17; y++) px(b, x, y, pal.stoneD)
  }
  // maple: trunk, branches, layered clumps lit from the upper left
  const { x: mx, y: my } = L.maple
  for (let y = my - 22; y <= my; y++) for (let d = -1; d <= 1; d++) px(b, mx + d + Math.round((my - y) * 0.08), y, pal.trunk)
  for (let i = 0; i < 10; i++) {
    px(b, mx - 2 - i, my - 18 - Math.round(i * 0.6), pal.trunk)
    px(b, mx + 3 + i, my - 20 - Math.round(i * 0.5), pal.trunk)
  }
  const clumps = [[-14, -27, 10, 6], [0, -32, 12, 7], [14, -26, 10, 6], [-6, -38, 9, 5], [8, -39, 8, 5], [-22, -22, 6, 4], [22, -21, 6, 4], [1, -44, 6, 4]]
  const inCanopy = (x: number, y: number) => clumps.some(([cx, cy, rx, ry]) => ((x - cx!) / rx!) ** 2 + ((y - cy!) / ry!) ** 2 <= 1 + (hash(x, y, 4) - 0.5) * 0.5)
  for (let y = -52; y <= -14; y++)
    for (let x = -32; x <= 32; x++) {
      if (!inCanopy(x, y)) continue
      let c = pal.maple
      if (!inCanopy(x, y + 1)) c = pal.mapleD
      else if (!inCanopy(x, y - 1) || (hash(x, y, 6) > 0.8 && x < 6)) c = pal.mapleH
      else if (y > -22 && hash(x, y, 5) > 0.5) c = pal.mapleD
      px(b, mx + x, my + y, c)
    }
  // raked gravel: concentric rings around the pond, stones and lantern; straight rows elsewhere
  const rings = [
    { cx: L.pond.cx, cy: L.pond.cy, rx: L.pond.rx + 3, ry: L.pond.ry + 2 },
    ...L.spots.map(([x, y]) => ({ cx: x, cy: y + 1, rx: 13, ry: 4 })),
    { cx: L.lantern.x, cy: L.lantern.y, rx: 10, ry: 3 },
  ]
  for (let y = L.gravelTop; y < H; y++)
    for (let x = 0; x < W; x++) {
      let k = -1
      for (const r of rings) {
        for (let j = 0; j < 5; j++) {
          const nx = (x - r.cx) / (r.rx + j * 3), ny = (y - r.cy) / (r.ry + j * 1.6)
          if (nx * nx + ny * ny <= 1) { k = j; break }
        }
        if (k >= 0) break
      }
      let c = pal.gravel
      if (k >= 0) c = k % 2 === 0 ? pal.rakeD : pal.gravel
      else if ((y - L.gravelTop) % 3 === 0) c = pal.rakeD
      else if ((y - L.gravelTop) % 3 === 1) c = pal.rakeL
      if (hash(x, y, 9) > 0.985) c = pal.stoneH
      px(b, x, y, c)
    }
  // bushes and mossy rocks along the wall, moss islands on the gravel
  for (let bx = 8 + Math.round(hash(1, 4) * 20); bx < W; bx += 26 + Math.round(hash(bx, 5) * 34)) {
    if (Math.abs(bx - mx) < 14 || Math.abs(bx - L.lantern.x) < 12) continue
    const kind = hash(bx, 6)
    if (kind < 0.22) {
      blob(b, bx, L.gravelTop + 3, 5, 3, pal.stone, pal.stoneH, pal.stoneD, 50 + bx)
      blob(b, bx - 2, L.gravelTop + 1, 3, 1, pal.moss, pal.mossH, pal.mossD, 60 + bx)
    } else blob(b, bx, L.gravelTop + 1, 6 + Math.round(kind * 6), 4 + Math.round(kind * 2), pal.bush, pal.bushH, pal.mossD, 30 + bx, kind > 0.55 ? pal.bloom : undefined)
  }
  const moss = L.portrait
    ? [[W * 0.14, L.gravelTop + 8, 14, 4], [W * 0.9, H - 30, 14, 4]]
    : [[W * 0.05, L.pond.cy + 10, 16, 5], [W * 0.95, H - 12, 18, 5], [W * 0.52, H - 5, 14, 3]]
  for (const [x, y, rx, ry] of moss) if (!L.spots.some(([sx, sy]) => Math.abs(sx - x!) < 20 && Math.abs(sy - y!) < 10)) blob(b, Math.round(x!), Math.round(y!), rx!, ry!, pal.moss, pal.mossH, pal.mossD, 21)
  // pond: stone rim, water with a reflected-sky dither, lily pad
  const { cx, cy, rx, ry } = L.pond
  for (let y = cy - ry - 3; y <= cy + ry + 3; y++)
    for (let x = cx - rx - 4; x <= cx + rx + 4; x++) {
      const rim = ((x - cx) / (rx + 2)) ** 2 + ((y - cy) / (ry + 2)) ** 2
      const water = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (water <= 1) {
        const t = (y - (cy - ry)) / (2 * ry)
        let c = dither(x, y, t) ? pal.waterD : pal.water
        if (y < cy - ry + 2) c = pal.waterD
        if (Math.abs(x - cx + rx * 0.3) < rx * 0.25 && y === cy - 3) c = pal.waterH
        px(b, x, y, c)
      } else if (rim <= 1) px(b, x, y, y > cy ? pal.stoneD : hash(x, y, 2) > 0.5 ? pal.stone : pal.stoneH)
    }
  const padX = cx + Math.round(rx * 0.45)
  blob(b, padX, cy + 4, 5, 2, pal.pad, pal.mossH, pal.mossD, 8)
  px(b, padX + 1, cy + 3, pal.bloom)
  // a stepping stone per member
  for (const [sx, sy0] of L.spots) {
    const sy = sy0 + 1, srx = 11, sry = 3
    for (let y = sy - sry - 1; y <= sy + sry + 2; y++)
      for (let x = sx - srx - 1; x <= sx + srx + 1; x++) {
        const top = ((x - sx) / srx) ** 2 + ((y - sy) / sry) ** 2
        const side = ((x - sx) / srx) ** 2 + ((y - sy - 2) / sry) ** 2
        if (top <= 1) px(b, x, y, y < sy - 1 && x < sx ? pal.stoneH : pal.stone)
        else if (side <= 1) px(b, x, y, pal.stoneD)
      }
  }
  // dithered contact shadows where each pet stands
  const shade = mix(pal.stoneD, '#1b1426', 0.45)
  for (const [sx, sy] of L.spots)
    for (let y = sy - 2; y <= sy + 2; y++)
      for (let x = sx - 9; x <= sx + 9; x++) {
        const e = ((x - sx) / 9) ** 2 + ((y - sy) / 2.2) ** 2
        if (e <= 1 && dither(x, y, (1 - e) * 0.9 + 0.15)) px(b, x, y, shade)
      }
  drawLantern(b, L, pal, phase)
  return b
}

function drawLantern(b: Buffer, L: GardenLayout, pal: Palette, phase: Phase) {
  const ox = L.lantern.x - 7, oy = L.lantern.y - LANTERN.length + 1
  const map: Record<string, string> = { K: pal.stoneD, S: pal.stone, H: pal.stoneH, D: pal.stoneD, L: phase.night ? '#ffd27a' : pal.stoneD }
  LANTERN.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') px(b, ox + x, oy + y, map[ch]!) }))
}

/** The lantern alone, so it can be redrawn on top of its own glow. */
export function bakeLantern(L: GardenLayout, pal: Palette, phase: Phase): Buffer {
  const b = makeBuffer(L.width, L.height)
  drawLantern(b, L, pal, phase)
  return b
}

/** An ordered-dither halo: solid near the centre, thinning to scattered pixels at the edge. */
export function bakeGlow(rx: number, ry: number, color: string, strength: number): Buffer {
  const b = makeBuffer(rx * 2 + 1, ry * 2 + 1)
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++) {
      const e = (x / rx) ** 2 + (y / ry) ** 2
      if (e <= 1 && dither(x + rx, y + ry, (1 - e) ** 2.2 * strength)) px(b, x + rx, y + ry, color)
    }
  return b
}
