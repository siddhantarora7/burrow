export interface Spot {
  /** Stone center in the 1600x1000 desktop viewBox. */
  x: number
  y: number
  /** Depth scale: stones nearer the wall are smaller. */
  scale: number
}

export const GARDEN_VIEWBOX = { w: 1600, h: 1000 } as const

// Front row first, so a small burrow fills the foreground around the pond.
export const GARDEN_SPOTS: readonly Spot[] = [
  { x: 380, y: 700, scale: 1 },
  { x: 1220, y: 700, scale: 1 },
  { x: 640, y: 870, scale: 1.05 },
  { x: 980, y: 880, scale: 1.05 },
  { x: 190, y: 880, scale: 1.05 },
  { x: 1420, y: 880, scale: 1.05 },
  { x: 560, y: 545, scale: 0.82 },
  { x: 1050, y: 545, scale: 0.82 },
  { x: 805, y: 505, scale: 0.76 },
]

export function spotsFor(count: number): Spot[] {
  return GARDEN_SPOTS.slice(0, Math.max(0, count))
}
