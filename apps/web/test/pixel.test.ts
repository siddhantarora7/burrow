import { describe, expect, it } from 'vitest'
import { PET_STATES, SPECIES } from '@burrow/core'
import { paletteAt, phaseAt } from '../lib/pixel/palette'
import { C, FRAMES, GRID, petGrid } from '../lib/pixel/sprites'

describe('phaseAt', () => {
  it('is day at noon, night at 22:00, dusk around 18:40', () => {
    expect(phaseAt(12)).toMatchObject({ night: false, dusk: 0 })
    expect(phaseAt(22).night).toBe(true)
    expect(phaseAt(18.6).dusk).toBeGreaterThan(0.9)
  })
})

describe('paletteAt', () => {
  it('gives a hex colour for every role at every quarter hour', () => {
    for (let h = 0; h < 24; h += 0.25) for (const v of Object.values(paletteAt(h))) expect(v).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('petGrid', () => {
  const body = new Set<number>([C.B, C.H, C.S, C.N])
  it.each(SPECIES)('%s: every state and frame is outlined, so pets never blend into the garden', (species) => {
    for (const state of PET_STATES) {
      for (let f = 0; f < FRAMES[state]; f++) {
        for (const quiet of state === 'work' ? [false, true] : [false]) {
          const g = petGrid(species, state, f, quiet)
          expect(g).toHaveLength(GRID)
          let bodyPx = 0
          for (let y = 0; y < GRID; y++)
            for (let x = 0; x < GRID; x++) {
              if (!body.has(g[y]![x]!)) continue
              bodyPx++
              // a body pixel never touches empty space: there is always outline (or face/props) between
              for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) expect(g[y + dy]?.[x + dx], `${species} ${state} ${f} at ${x},${y}`).not.toBe(C.E)
            }
          expect(bodyPx).toBeGreaterThan(120)
        }
      }
    }
  })
  it('has two open eyes when idle and closed eyes when asleep or quiet', () => {
    const count = (g: number[][], v: number) => g.flat().filter((p) => p === v).length
    expect(count(petGrid('mochi', 'idle', 0), C.W)).toBe(2) // eye glints
    expect(count(petGrid('mochi', 'sleep', 0), C.W)).toBe(0)
    expect(count(petGrid('mochi', 'work', 0, true), C.W)).toBe(0)
    expect(count(petGrid('mochi', 'work', 0, false), C.W)).toBe(2)
  })
  it('is deterministic', () => {
    expect(petGrid('onigiri', 'cheer', 2)).toEqual(petGrid('onigiri', 'cheer', 2))
  })
})

import { layoutGarden } from '@burrow/core'
import { bakeGround, bakeSky } from '../lib/pixel/scene'

describe('scene baking', () => {
  const rgb = (b: { w: number; data: Uint8ClampedArray }, x: number, y: number) => {
    const i = (y * b.w + x) * 4
    return '#' + [b.data[i], b.data[i + 1], b.data[i + 2]].map((v) => v!.toString(16).padStart(2, '0')).join('')
  }
  it.each([[336, 182], [130, 282]])('%ix%i: sky on top, water in the pond, ground left transparent above the hills', (W, H) => {
    const L = layoutGarden(W, H, 4)
    const pal = paletteAt(12), ph = phaseAt(12)
    const sky = bakeSky(L, pal, ph), ground = bakeGround(L, pal, ph)
    expect(rgb(sky, 0, 0)).toBe(pal.sky0)
    expect([pal.water, pal.waterD, pal.waterH]).toContain(rgb(ground, L.pond.cx, L.pond.cy))
    expect(ground.data[3]).toBe(0) // top-left corner is sky, not ground
  })
  it('lights the lantern only at night', () => {
    const L = layoutGarden(336, 182, 2)
    const lit = (h: number) => {
      const b = bakeGround(L, paletteAt(h), phaseAt(h))
      return rgb(b, L.lantern.x, L.lantern.y - 22 + 9)
    }
    expect(lit(22)).toBe('#ffd27a')
    expect(lit(12)).not.toBe('#ffd27a')
  })
})

describe('the working pose (the state people see most)', () => {
  it.each(SPECIES)('%s: the face stays readable above the laptop', (species) => {
    for (const f of [0, 1]) {
      const g = petGrid(species, 'work', f, false)
      const rows = (v: number) => g.map((r, y) => (r.includes(v as never) ? y : -1)).filter((y) => y >= 0)
      const lidTop = Math.min(...rows(C.L1)) - 1 // the lid outline sits just above its first light row
      const eyeBottom = Math.max(...g.map((r, y) => (r.some((v, x) => v === C.F && x < 15) ? y : -1)).filter((y) => y < lidTop))
      expect(rows(C.W).length, `${species} f${f} glints`).toBeGreaterThanOrEqual(1)
      expect(g.flat().filter((v) => v === C.W)).toHaveLength(2)
      expect(lidTop - eyeBottom, `${species} f${f}: body between eyes and lid`).toBeGreaterThanOrEqual(2)
      expect(g.flat().some((v) => v === C.P), `${species} f${f}: blush`).toBe(true)
    }
  })
  it('breathes: one frame squashes, like idle does', () => {
    const height = (g: number[][]) => g.findIndex((r) => r.some((v) => v !== C.E))
    expect(height(petGrid('mochi', 'work', 0))).not.toBe(height(petGrid('mochi', 'work', 1)))
  })
})

describe('round-two fixes', () => {
  it('onigiri: the nori band starts below the face, so eyes and mouth stay on rice', () => {
    for (const state of PET_STATES) {
      const g = petGrid('onigiri', state, 0)
      const noriTop = g.findIndex((r) => r.includes(C.N as never))
      if (noriTop < 0) continue // hidden behind the laptop
      const faceRows = g.map((r, y) => (r.some((v) => v === C.F) ? y : -1)).filter((y) => y >= 0 && y < noriTop)
      const lastFace = Math.max(...faceRows)
      expect(noriTop - lastFace, `${state}`).toBeGreaterThanOrEqual(2)
    }
  })
  it('every z is outlined, so it reads over water, gravel or sky', () => {
    for (const [state, quiet] of [['sleep', false], ['work', true]] as const) {
      for (let f = 0; f < FRAMES[state]; f++) {
        const g = petGrid('mochi', state, f, quiet)
        g.forEach((row, y) => row.forEach((v, x) => {
          if (v !== C.Z) return
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) expect(g[y + dy]?.[x + dx], `${state} f${f} z at ${x},${y}`).not.toBe(C.E)
        }))
      }
    }
  })
})
