// Ambient motion in garden pixels per second, stepped by the real frame time, so a 120 Hz screen
// moves hearts, leaves and fireflies at the same speed as a 60 Hz one. Pure: the canvas only draws.

export interface Heart { x: number; y: number; vx: number; vy: number; life: number }
export interface Leaf { x: number; y: number; ground: number; rest: number; seed: number }
export interface Fly { x: number; y: number; s: number }
/** `born` is a performance.now() timestamp, so a ripple's age is wall time, not frames drawn. */
export interface Ripple { x: number; y: number; born: number }

export const HEART_MS = 1120
/** Hearts hold steady, then blink out over their last 320 ms. */
export const heartVisible = (h: Heart) => h.life < 800 || Math.floor(h.life / 96) % 2 === 1
export const LEAF_FALL = 9
export const LEAF_REST_MS = 9000
export const RIPPLE_MS = 1400

/** Three hearts rising from a booped pet's head. */
export function heartsAt(x: number, y: number): Heart[] {
  return [0, 1, 2].map((k) => ({ x: x + (k - 1) * 5, y: y - 24, vx: (k - 1) * 9, vy: -21 - k * 3, life: 0 }))
}

/** Advances a heart by dt ms; false once it has blinked out. */
export function stepHeart(h: Heart, dt: number): boolean {
  h.x += (h.vx * dt) / 1000
  h.y += (h.vy * dt) / 1000
  h.life += dt
  return h.life < HEART_MS
}

/** A leaf falls with a sway, then rests on the gravel; false once it should vanish. */
export function stepLeaf(l: Leaf, dt: number, now: number): boolean {
  if (l.y < l.ground) {
    l.y += (LEAF_FALL * dt) / 1000
    l.x += (Math.sin(now / 500 + l.seed) * 9 * dt) / 1000
  } else l.rest += dt
  return l.rest < LEAF_REST_MS
}

/** Fireflies wander on slow sine paths. */
export function stepFly(f: Fly, dt: number, now: number): void {
  f.x += (Math.sin(now / 900 + f.s) * 4.8 * dt) / 1000
  f.y += (Math.cos(now / 1100 + f.s) * 3 * dt) / 1000
}

/**
 * Ripples still running at `now`, with their age in seconds. Ageing by the clock (not by frames
 * drawn) drops a ripple queued while the tab was hidden instead of playing it minutes later.
 */
export function liveRipples(ripples: readonly Ripple[], now: number): Array<Ripple & { age: number }> {
  return ripples.map((r) => ({ ...r, age: Math.max(0, now - r.born) / 1000 })).filter((r) => r.age * 1000 < RIPPLE_MS)
}
