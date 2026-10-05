import { describe, expect, it } from 'vitest'
import { layoutGarden, MAX_MEMBERS } from '../src/garden'

// Logical pixel sizes the web renderer produces: 1680x906 at 5x, 1440x900 at 5x, 390x844 at 3x.
const VIEWPORTS: Array<[string, number, number]> = [
  ['desktop 1680', 336, 182],
  ['desktop 1440', 288, 180],
  ['phone 390', 130, 282],
]

describe('layoutGarden', () => {
  it.each(VIEWPORTS)('%s: places every pet up to 24, apart, on the gravel, off the pond', (_, W, H) => {
    for (let n = 0; n <= MAX_MEMBERS; n++) {
      const g = layoutGarden(W, H, n)
      expect(g.spots, `${n}`).toHaveLength(n)
      for (const [x, y] of g.spots) {
        expect(x).toBeGreaterThanOrEqual(10)
        expect(x).toBeLessThanOrEqual(W - 10)
        expect(y).toBeGreaterThanOrEqual(g.gravelTop + 12)
        expect(y + 16).toBeLessThanOrEqual(g.height) // room for the name tag
        const dx = (x - g.pond.cx) / (g.pond.rx + 12), dy = (y - g.pond.cy) / (g.pond.ry + 8)
        expect(dx * dx + dy * dy, `${n}: (${x},${y}) on the pond`).toBeGreaterThan(1)
      }
      for (let i = 0; i < g.spots.length; i++)
        for (let j = i + 1; j < g.spots.length; j++) {
          const [ax, ay] = g.spots[i]!, [bx, by] = g.spots[j]!
          expect(Math.abs(ax - bx) >= 26 || Math.abs(ay - by) >= 36, `${n}: ${i}/${j} overlap`).toBe(true)
        }
    }
  })
  it.each(VIEWPORTS)('%s: fits the screen for a small burrow and scrolls only when it must', (_, W, H) => {
    expect(layoutGarden(W, H, 4).height).toBe(H)
    expect(layoutGarden(W, H, 24).height).toBeGreaterThan(H)
  })
  it('is deterministic: join order decides the spot', () => {
    expect(layoutGarden(336, 182, 6)).toEqual(layoutGarden(336, 182, 6))
    expect(layoutGarden(336, 182, 6).spots.slice(0, 3)).toEqual(layoutGarden(336, 182, 3).spots)
  })
  it('the first pet on a phone sits front and center above the pond', () => {
    const g = layoutGarden(130, 282, 1)
    expect(Math.abs(g.spots[0]![0] - 65)).toBeLessThanOrEqual(8)
    expect(g.spots[0]![1]).toBeLessThan(g.pond.cy)
  })
  it('keeps the lantern and maple inside the scene', () => {
    for (const [, W, H] of VIEWPORTS) {
      const g = layoutGarden(W, H, 3)
      expect(g.lantern.x).toBeGreaterThan(8)
      expect(g.lantern.x).toBeLessThan(W - 8)
      expect(g.maple.x).toBeLessThan(W)
    }
  })
})
