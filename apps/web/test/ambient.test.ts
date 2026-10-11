import { describe, expect, it } from 'vitest'
import { heartsAt, liveRipples, stepFly, stepHeart, stepLeaf, type Fly, type Heart, type Leaf } from '../lib/pixel/ambient'

// Run a stepper for `ms` of wall time at a given refresh rate.
function run(hz: number, ms: number, step: (dt: number, now: number) => void) {
  const dt = 1000 / hz
  for (let now = dt; now <= ms + 1e-9; now += dt) step(dt, now)
}

describe('ambient motion is tied to time, not frame rate', () => {
  it.each([120, 144])('hearts rise the same distance at 60 Hz and %i Hz', (hz) => {
    const a = heartsAt(50, 80), b = heartsAt(50, 80)
    run(60, 500, (dt) => a.forEach((h) => stepHeart(h, dt)))
    run(hz, 500, (dt) => b.forEach((h) => stepHeart(h, dt)))
    a.forEach((h, i) => {
      expect(b[i]!.x).toBeCloseTo(h.x, 6)
      expect(b[i]!.y).toBeCloseTo(h.y, 6)
      expect(b[i]!.life).toBeCloseTo(h.life, 6)
    })
    expect(a[1]!.y).toBeLessThan(56 - 10) // they really do rise
  })

  it('hearts blink out after the same wall time at any rate', () => {
    const lifetime = (hz: number) => {
      const h: Heart = heartsAt(0, 0)[0]!
      let t = 0
      while (stepHeart(h, 1000 / hz)) t += 1000 / hz
      return t
    }
    expect(Math.abs(lifetime(120) - lifetime(60))).toBeLessThan(1000 / 60)
  })

  it('a falling leaf sways and lands the same at 60 Hz and 120 Hz', () => {
    const leaf = (): Leaf => ({ x: 100, y: 0, ground: 30, rest: 0, seed: 1.3 })
    const a = leaf(), b = leaf()
    run(60, 2500, (dt, now) => stepLeaf(a, dt, now))
    run(120, 2500, (dt, now) => stepLeaf(b, dt, now))
    expect(b.x).toBeCloseTo(a.x, 1)
    expect(b.y).toBeCloseTo(a.y, 6)
  })

  it('fireflies wander the same at 60 Hz and 120 Hz', () => {
    const a: Fly = { x: 40, y: 90, s: 2 }, b: Fly = { ...a }
    run(60, 3000, (dt, now) => stepFly(a, dt, now))
    run(120, 3000, (dt, now) => stepFly(b, dt, now))
    expect(b.x).toBeCloseTo(a.x, 1)
    expect(b.y).toBeCloseTo(a.y, 1)
  })
})

describe('liveRipples', () => {
  it('ages a ripple by the clock', () => {
    const [r] = liveRipples([{ x: 1, y: 2, born: 1000 }], 1700)
    expect(r?.age).toBeCloseTo(0.7)
  })
  it('drops a ripple queued while the tab was hidden instead of playing it minutes later', () => {
    expect(liveRipples([{ x: 1, y: 2, born: 1000 }], 1000 + 3 * 60_000)).toEqual([])
  })
  it('treats a ripple born just after the frame started as brand new', () => {
    expect(liveRipples([{ x: 1, y: 2, born: 1005 }], 1000)[0]?.age).toBe(0)
  })
})
