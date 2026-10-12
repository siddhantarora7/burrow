import { describe, expect, it } from 'vitest'
import { DEFAULT_COLOR, PET_COLORS, PET_STATES, SPECIES, STAGES, type PetColor } from '@burrow/core'
import { paletteAt, phaseAt } from '../lib/pixel/palette'
import { C, colorsFor, FRAMES, GRID, PET_INK, PET_TONES, petGrid, silhouette, toneOf } from '../lib/pixel/sprites'

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
  it.each(SPECIES.flatMap((sp) => STAGES.map((st) => [sp, st] as const)))('%s %s: every state and frame is outlined, so pets never blend into the garden', (species, stage) => {
    for (const state of PET_STATES) {
      for (let f = 0; f < FRAMES[state]; f++) {
        for (const quiet of state === 'work' ? [false, true] : [false]) {
          const g = petGrid(species, state, f, quiet, stage)
          expect(g).toHaveLength(GRID)
          let bodyPx = 0
          for (let y = 0; y < GRID; y++)
            for (let x = 0; x < GRID; x++) {
              if (!body.has(g[y]![x]!)) continue
              bodyPx++
              // a body pixel never touches empty space: there is always outline (or face/props) between
              for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) expect(g[y + dy]?.[x + dx], `${species} ${state} ${f} at ${x},${y}`).not.toBe(C.E)
            }
          expect(bodyPx).toBeGreaterThan(stage === 'baby' ? 60 : 120)
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
  it.each(SPECIES.flatMap((sp) => STAGES.map((st) => [sp, st] as const)))('%s %s: the face stays readable above the laptop', (species, stage) => {
    for (const f of [0, 1]) {
      const g = petGrid(species, 'work', f, false, stage)
      const rows = (v: number) => g.map((r, y) => (r.includes(v as never) ? y : -1)).filter((y) => y >= 0)
      const lidTop = Math.min(...rows(C.L1)) - 1 // the lid outline sits just above its first light row
      const eyeBottom = Math.max(...g.map((r, y) => (r.some((v, x) => v === C.F && x < 15) ? y : -1)).filter((y) => y < lidTop))
      expect(rows(C.W).length, `${species} ${stage} f${f} glints`).toBeGreaterThanOrEqual(1)
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

describe('pet colours', () => {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  }
  const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
  const colors = Object.keys(PET_COLORS) as PetColor[]

  it('the body takes the member colour, not the species', () => {
    expect(colorsFor('sora')[C.B]).toBe(PET_TONES.sora.base)
    expect(colorsFor('fuji')[C.H]).toBe(PET_TONES.fuji.hi)
    expect(colorsFor('yuzu')[C.S]).toBe(PET_TONES.yuzu.shade)
  })
  it('falls back to the species colour when a member has none or an unknown one', () => {
    expect(toneOf('tofu', 'sora')).toBe('sora')
    for (const s of SPECIES) {
      expect(toneOf(s, undefined)).toBe(DEFAULT_COLOR[s])
      expect(toneOf(s, 'neon')).toBe(DEFAULT_COLOR[s])
    }
  })
  it.each(colors)('%s: brighter than the night garden and clear of its own outline (Brighter Pet Rule)', (c) => {
    const t = PET_TONES[c]
    expect(lum(t.hi)).toBeGreaterThan(lum(t.base))
    expect(lum(t.base)).toBeGreaterThan(lum(t.shade))
    expect(contrast(t.base, paletteAt(22).gravel)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t.shade, PET_INK)).toBeGreaterThanOrEqual(4.5)
  })
})

import { bakeGlow, GLOW } from '../lib/pixel/scene'

describe('lantern glow', () => {
  const colours = (b: ReturnType<typeof bakeGlow>) => {
    const seen = new Map<string, number[]>()
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++) {
        const i = (y * b.w + x) * 4
        if (!b.data[i + 3]) continue
        const k = `#${[0, 1, 2].map((j) => b.data[i + j]!.toString(16).padStart(2, '0')).join('')}`
        const d = Math.hypot((x - (b.w - 1) / 2) / ((b.w - 1) / 2), (y - (b.h - 1) / 2) / ((b.h - 1) / 2))
        seen.set(k, [...(seen.get(k) ?? []), d])
      }
    return seen
  }

  it('is opaque pixels in two golds, bright at the core and dim toward the edge', () => {
    const b = bakeGlow(GLOW.rx, GLOW.ry, GLOW.strength[1])
    const seen = colours(b)
    expect([...seen.keys()].sort()).toEqual([GLOW.core, GLOW.dim].sort())
    const mean = (xs: number[]) => xs.reduce((a, c) => a + c, 0) / xs.length
    expect(mean(seen.get(GLOW.core)!)).toBeLessThan(mean(seen.get(GLOW.dim)!))
    for (let i = 3; i < b.data.length; i += 4) expect([0, 255]).toContain(b.data[i])
  })

  it('stays a small pool around the lantern, not a wide square of dots', () => {
    expect(GLOW.rx).toBeLessThanOrEqual(18)
    const lit = [...colours(bakeGlow(GLOW.rx, GLOW.ry, GLOW.strength[1])).values()].flat().length
    expect(lit / ((2 * GLOW.rx + 1) * (2 * GLOW.ry + 1))).toBeLessThan(0.3)
  })
})

describe('growth forms', () => {
  const filled = (g: number[][]) => g.flat().filter((v) => v !== C.E).length
  const body = (g: number[][]) => g.flat().filter((v) => v === C.B || v === C.H || v === C.S || v === C.N || v === C.D).length

  it.each(SPECIES)('%s: a baby is smaller than its grown form', (species) => {
    expect(body(petGrid(species, 'idle', 0, false, 'baby'))).toBeLessThan(body(petGrid(species, 'idle', 0, false, 'grown')) * 0.8)
  })

  it.each(SPECIES)('%s: the evolved form is the grown one plus a detail that sticks out', (species) => {
    for (const state of PET_STATES) {
      const grown = petGrid(species, state, 0, false, 'grown')
      const evolved = petGrid(species, state, 0, false, 'evolved')
      let extra = 0
      grown.forEach((row, y) => row.forEach((v, x) => {
        if (v !== C.E) expect(evolved[y]![x], `${species} ${state} lost ${x},${y}`).not.toBe(C.E)
        else if (evolved[y]![x] !== C.E) extra++
      }))
      expect(extra, `${species} ${state}`).toBeGreaterThanOrEqual(6)
    }
  })

  it('new species keep their own silhouettes', () => {
    const shape = (species: (typeof SPECIES)[number]) => petGrid(species, 'idle', 0).map((r) => r.map((v) => (v === C.E ? 0 : 1)).join('')).join('')
    expect(new Set(SPECIES.map(shape)).size).toBe(SPECIES.length)
    expect(filled(petGrid('dorayaki', 'idle', 0))).toBeGreaterThan(filled(petGrid('dango', 'idle', 0)) * 0.9)
  })

  it('dorayaki: the anko band sits below the face', () => {
    const g = petGrid('dorayaki', 'idle', 0)
    const anko = g.findIndex((r) => r.includes(C.D as never))
    const lastFace = Math.max(...g.map((r, y) => (r.includes(C.F as never) ? y : -1)))
    expect(anko).toBeGreaterThan(0)
    expect(anko).toBeGreaterThan(lastFace)
  })

  it('a silhouette is all ink, for the catalog\'s undiscovered forms', () => {
    const g = silhouette(petGrid('taiyaki', 'idle', 0, false, 'evolved'))
    expect(new Set(g.flat())).toEqual(new Set([C.E, C.O]))
  })
})
