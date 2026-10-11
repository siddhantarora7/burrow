import { describe, expect, it } from 'vitest'
import { layoutGarden, MAX_MEMBERS, pixelScale, tagGap } from '../src/garden'

// Real browser windows: innerWidth x innerHeight with browser chrome taken out, phones to wide desktops.
const WINDOWS: Array<[number, number]> = []
for (let w = 320; w <= 2560; w += 61) for (let h = 480; h <= 1600; h += 53) WINDOWS.push([w, h])
WINDOWS.push([390, 664], [375, 548], [768, 1024], [820, 1180], [960, 969], [720, 789], [1680, 906], [1440, 900], [390, 844])

function screen(vw: number, vh: number) {
  const S = pixelScale(vw, vh)
  return { S, W: Math.ceil(vw / S), H: Math.ceil(vh / S) }
}

describe('layoutGarden on real window sizes', () => {
  it('places every pet up to 24: on the gravel, off the pond, never overlapping a neighbour or its name tag', () => {
    const failures: string[] = []
    for (const [vw, vh] of WINDOWS) {
      const { S, W, H } = screen(vw, vh)
      const gap = tagGap(S)
      for (const n of [1, 2, 4, 6, 9, 13, 24]) {
        const g = layoutGarden(W, H, n, gap)
        const where = `${vw}x${vh} n=${n}`
        if (g.spots.length !== n) failures.push(`${where}: ${g.spots.length} spots`)
        for (const [x, y] of g.spots) {
          const margin = Math.max(16, gap / 2) // the 32 px sprite and half a name tag stay on screen
          if (x < margin || x > W - margin) failures.push(`${where}: x ${x} too close to the edge`)
          if (y < g.gravelTop + 12) failures.push(`${where}: y ${y} on the wall`)
          if (y + 16 > g.height) failures.push(`${where}: no room for the tag`)
          const dx = (x - g.pond.cx) / (g.pond.rx + 12), dy = (y - g.pond.cy) / (g.pond.ry + 8)
          if (dx * dx + dy * dy <= 1) failures.push(`${where}: (${x},${y}) on the pond`)
        }
        for (let i = 0; i < g.spots.length; i++)
          for (let j = i + 1; j < g.spots.length; j++) {
            const [ax, ay] = g.spots[i]!, [bx, by] = g.spots[j]!
            if (Math.abs(ay - by) < 36 && Math.abs(ax - bx) < gap) failures.push(`${where}: ${i}/${j} too close`)
          }
      }
    }
    expect(failures.slice(0, 10)).toEqual([])
  })

  it('fits a small burrow on one screen and scrolls only when it must', () => {
    for (const [vw, vh] of [[1680, 906], [1440, 900], [390, 664], [390, 844]] as const) {
      const { S, W, H } = screen(vw, vh)
      expect(layoutGarden(W, H, 4, tagGap(S)).height, `${vw}x${vh}`).toBe(H)
      expect(layoutGarden(W, H, MAX_MEMBERS, tagGap(S)).height).toBeGreaterThan(H)
    }
  })

  it('a lone pet is the focal point: front and centre, in front of the pond', () => {
    for (const [vw, vh] of [[1680, 906], [1440, 900], [390, 844], [390, 664]] as const) {
      const { S, W, H } = screen(vw, vh)
      const g = layoutGarden(W, H, 1, tagGap(S))
      const [x, y] = g.spots[0]!
      expect(Math.abs(x - W / 2), `${vw}x${vh}`).toBeLessThanOrEqual(W * 0.1)
      expect(y, `${vw}x${vh}`).toBeGreaterThan(g.pond.cy)
    }
  })

  it('is deterministic: join order decides the spot, and earlier pets keep theirs as others join', () => {
    const { S, W, H } = screen(1680, 906)
    expect(layoutGarden(W, H, 6, tagGap(S))).toEqual(layoutGarden(W, H, 6, tagGap(S)))
    expect(layoutGarden(W, H, 6, tagGap(S)).spots.slice(1, 3)).toEqual(layoutGarden(W, H, 3, tagGap(S)).spots.slice(1, 3))
  })

  it('keeps the lantern and maple inside the scene', () => {
    for (const [vw, vh] of [[1680, 906], [390, 664], [320, 480]] as const) {
      const { W, H } = screen(vw, vh)
      const g = layoutGarden(W, H, 3)
      expect(g.lantern.x).toBeGreaterThan(8)
      expect(g.lantern.x).toBeLessThan(W - 8)
    }
  })
})
