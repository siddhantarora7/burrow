import { describe, expect, it } from 'vitest'
import { GARDEN_LAYOUTS, spotsFor, type GardenLayout } from '../src/garden'

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
