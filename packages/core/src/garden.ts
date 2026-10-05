/** Spec §5: members per burrow at launch. */
export const MAX_MEMBERS = 24

export interface GardenLayout {
  /** Logical (pre-scale) pixel size of the scene. `height` grows past the screen for big burrows. */
  width: number
  height: number
  portrait: boolean
  horizon: number
  gravelTop: number
  pond: { cx: number; cy: number; rx: number; ry: number }
  lantern: { x: number; y: number }
  maple: { x: number; y: number }
  fuji: { x: number; peak: number }
  /** One [x, y] per member in join order; y is where the pet's feet touch its stone. */
  spots: Array<[number, number]>
}

/**
 * The zen garden for a `W`x`H` logical-pixel screen and `count` members. Deterministic: the first
 * members always get the same spots, and later rows extend the gravel downward (the page scrolls).
 */
export function layoutGarden(W: number, H: number, count: number): GardenLayout {
  const portrait = H > W
  const n = Math.max(0, Math.min(count, MAX_MEMBERS))
  const horizon = portrait ? Math.round(Math.min(96, H * 0.27)) : Math.round(Math.min(92, H * 0.47))
  const gravelTop = horizon + 17
  const pond = portrait
    ? { cx: Math.round(W * 0.5), cy: Math.round(gravelTop + (H - gravelTop) * 0.42), rx: Math.round(Math.min(46, W * 0.3)), ry: 12 }
    : { cx: Math.round(W * 0.53), cy: Math.round(gravelTop + (H - gravelTop) * 0.4), rx: Math.round(Math.min(48, W * 0.15)), ry: 13 }
  const front = H - 16
  const pondFront = pond.cy + pond.ry

  // The first screenful, best spots first.
  const base: Array<[number, number]> = portrait
    ? [
        [W * 0.5, pond.cy - pond.ry - 16],
        [W * 0.24, pondFront + 24],
        [W * 0.76, pondFront + 24],
        [W * 0.5, pondFront + 54],
        [W * 0.2, front],
        [W * 0.8, front],
      ]
    : [
        [W * 0.24, pond.cy - 2],
        [W * 0.82, pond.cy - 8],
        [W * 0.4, front],
        [W * 0.64, front],
        [W * 0.12, front],
        [W * 0.88, front],
      ]
  const spots: Array<[number, number]> = base
    .map(([x, y]) => [Math.round(x), Math.round(Math.min(front, y))] as [number, number])
    .slice(0, n)

  // Further rows below the first screen, alternating so stones never line up into a grid.
  const lastBaseY = Math.max(...base.map(([, y]) => Math.min(front, Math.round(y))))
  for (let k = 0; spots.length < n; k++) {
    const row = Math.floor(k / (portrait ? 2 : 4))
    const col = k % (portrait ? 2 : 4)
    const xs = portrait ? (row % 2 ? [0.32, 0.68] : [0.2, 0.8]) : row % 2 ? [0.26, 0.5, 0.74, 0.92] : [0.1, 0.36, 0.62, 0.86]
    spots.push([Math.round(W * xs[col]!), lastBaseY + 36 * (row + 1)])
  }

  const lowest = spots.reduce((m, [, y]) => Math.max(m, y), 0)
  return {
    width: W,
    height: Math.max(H, lowest + 16),
    portrait,
    horizon,
    gravelTop,
    pond,
    lantern: { x: Math.round(W * (portrait ? 0.86 : 0.93)), y: gravelTop + (portrait ? 30 : 24) },
    maple: { x: Math.round(W * (portrait ? 0.8 : 0.78)), y: horizon + 13 },
    fuji: { x: Math.round(W * (portrait ? 0.32 : 0.3)), peak: Math.round(horizon * 0.38) },
    spots,
  }
}
