import { describe, expect, it } from 'vitest'
import { GARDEN_LAYOUTS, gardenFor, MAX_MEMBERS, spotsFor, type GardenLayout } from '../src/garden'

const layouts: GardenLayout[] = ['wide', 'tall']

describe('garden spots', () => {
  it.each(layouts)('%s: returns exactly as many spots as members, in a stable order', (layout) => {
    const { spots } = GARDEN_LAYOUTS[layout]
    expect(spotsFor(0, layout)).toEqual([])
    expect(spotsFor(3, layout)).toEqual(spots.slice(0, 3))
    expect(spotsFor(40, layout)).toHaveLength(spots.length)
  })
  it.each(layouts)('%s: keeps every spot inside the scene, on the gravel, clear of the pond', (layout) => {
    const g = GARDEN_LAYOUTS[layout]
    for (const s of g.spots) {
      expect(s.x).toBeGreaterThan(g.w * 0.08)
      expect(s.x).toBeLessThan(g.w * 0.92)
      expect(s.y).toBeGreaterThan(g.gravelY + 40)
      expect(s.y).toBeLessThan(g.h - 40)
      const dx = (s.x - g.pond.cx) / (g.pond.rx + 60)
      const dy = (s.y - g.pond.cy) / (g.pond.ry + 40)
      expect(dx * dx + dy * dy).toBeGreaterThan(1)
    }
  })
  it('the first spot of the tall layout is near the horizontal center, so a lone pet is visible on a phone', () => {
    const g = GARDEN_LAYOUTS.tall
    expect(Math.abs(g.spots[0]!.x - g.w / 2)).toBeLessThan(g.w * 0.2)
  })
  it('spots are spread out: no two stones overlap', () => {
    for (const layout of layouts) {
      const s = GARDEN_LAYOUTS[layout].spots
      for (let i = 0; i < s.length; i++)
        for (let j = i + 1; j < s.length; j++) {
          const d = Math.hypot(s[i]!.x - s[j]!.x, (s[i]!.y - s[j]!.y) * 2)
          expect(d, `${layout} ${i}/${j}`).toBeGreaterThan(170)
        }
    }
  })
})

describe('gardenFor: the garden grows with the burrow', () => {
  const ok = (layout: GardenLayout, count: number) => {
    const g = gardenFor(count, layout)
    expect(g.spots, `${layout} ${count}`).toHaveLength(Math.min(count, MAX_MEMBERS))
    for (const s of g.spots) {
      expect(s.x).toBeGreaterThan(g.w * 0.08)
      expect(s.x).toBeLessThan(g.w * 0.92)
      expect(s.y).toBeGreaterThan(g.gravelY + 40)
      expect(s.y + 60).toBeLessThan(g.h)
      const dx = (s.x - g.pond.cx) / (g.pond.rx + 60), dy = (s.y - g.pond.cy) / (g.pond.ry + 40)
      expect(dx * dx + dy * dy).toBeGreaterThan(1)
    }
    for (let i = 0; i < g.spots.length; i++)
      for (let j = i + 1; j < g.spots.length; j++) {
        const a = g.spots[i]!, b = g.spots[j]!
        expect(Math.hypot(a.x - b.x, (a.y - b.y) * 2), `${layout} ${count}: ${i}/${j}`).toBeGreaterThan(170)
      }
    for (const m of g.moss) expect(m.y + m.ry).toBeLessThanOrEqual(g.h)
    return g
  }
  it.each(['wide', 'tall'] as const)('%s: places every pet up to 24, inside, apart, off the pond', (layout) => {
    for (let n = 0; n <= MAX_MEMBERS; n++) ok(layout, n)
  })
  it('never silently drops pets below the member cap', () => {
    expect(gardenFor(24, 'wide').spots).toHaveLength(24)
    expect(gardenFor(24, 'tall').spots).toHaveLength(24)
  })
  it('a lone pet is the focal point: larger, and the phone garden ends just below the pond', () => {
    expect(gardenFor(1, 'wide').spots[0]!.scale).toBeGreaterThanOrEqual(1.4)
    const tall = gardenFor(1, 'tall')
    expect(tall.spots[0]!.scale).toBeGreaterThanOrEqual(1.4)
    expect(tall.h).toBeLessThanOrEqual(tall.pond.cy + tall.pond.ry + 260)
  })
  it('grows taller as members join, never shorter than the base scene', () => {
    expect(gardenFor(24, 'tall').h).toBeGreaterThan(gardenFor(7, 'tall').h)
    expect(gardenFor(24, 'wide').h).toBeGreaterThan(gardenFor(9, 'wide').h)
    expect(gardenFor(3, 'wide').h).toBe(GARDEN_LAYOUTS.wide.h)
  })
})

describe('gardenFor: fills the viewport instead of cropping it', () => {
  it('extends the gravel down to a minimum height, keeping the bottom moss on the ground', () => {
    const g = gardenFor(1, 'tall', 1732)
    expect(g.h).toBe(1732)
    for (const m of g.moss) expect(m.y + m.ry).toBeLessThanOrEqual(g.h)
    expect(gardenFor(1, 'tall', 10).h).toBe(gardenFor(1, 'tall').h)
  })
})
