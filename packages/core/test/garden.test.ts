import { describe, expect, it } from 'vitest'
import { GARDEN_SPOTS, GARDEN_VIEWBOX, spotsFor } from '../src/garden'

describe('garden spots', () => {
  it('returns exactly as many spots as members, in a stable order', () => {
    expect(spotsFor(0)).toEqual([])
    expect(spotsFor(3)).toEqual(GARDEN_SPOTS.slice(0, 3))
    expect(spotsFor(5)).toEqual(spotsFor(5))
  })
  it('keeps every spot inside the scene and on the gravel', () => {
    for (const s of GARDEN_SPOTS) {
      expect(s.x).toBeGreaterThan(80)
      expect(s.x).toBeLessThan(GARDEN_VIEWBOX.w - 80)
      expect(s.y).toBeGreaterThan(470)
      expect(s.y).toBeLessThan(GARDEN_VIEWBOX.h - 40)
    }
  })
  it('caps at the defined spots for milestone 1', () => {
    expect(spotsFor(40)).toHaveLength(GARDEN_SPOTS.length)
  })
})
