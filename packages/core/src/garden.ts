export interface Spot {
  /** Stone center in the layout's viewBox. */
  x: number
  y: number
  /** Depth scale: stones nearer the wall are smaller. */
  scale: number
}

export type GardenLayout = 'wide' | 'tall'

export interface GardenGeometry {
  w: number
  h: number
  /** Top of the garden wall. */
  wallY: number
  /** Where the raked gravel starts. */
  gravelY: number
  pond: { cx: number; cy: number; rx: number; ry: number }
  lantern: { x: number; y: number; scale: number }
  maple: { x: number; y: number; scale: number }
  moss: ReadonlyArray<{ x: number; y: number; rx: number; ry: number }>
  /** Front spots first, so a small burrow fills the foreground. */
  spots: readonly Spot[]
}

export const GARDEN_LAYOUTS: Record<GardenLayout, GardenGeometry> = {
  // Desktop and landscape: pond in the middle, stones around it.
  wide: {
    w: 1600,
    h: 1000,
    wallY: 420,
    gravelY: 470,
    pond: { cx: 800, cy: 700, rx: 250, ry: 82 },
    lantern: { x: 1480, y: 640, scale: 1 },
    maple: { x: 1330, y: 470, scale: 1 },
    moss: [
      { x: 120, y: 640, rx: 90, ry: 26 },
      { x: 1300, y: 960, rx: 120, ry: 30 },
    ],
    spots: [
      { x: 380, y: 700, scale: 1 },
      { x: 1220, y: 700, scale: 1 },
      { x: 640, y: 870, scale: 1.05 },
      { x: 980, y: 880, scale: 1.05 },
      { x: 190, y: 880, scale: 1.05 },
      { x: 1420, y: 880, scale: 1.05 },
      { x: 560, y: 545, scale: 0.82 },
      { x: 1050, y: 545, scale: 0.82 },
      { x: 805, y: 525, scale: 0.76 },
    ],
  },
  // Phones and portrait: one pet front and center above the pond, the rest down the path.
  tall: {
    w: 800,
    h: 1400,
    wallY: 360,
    gravelY: 410,
    pond: { cx: 400, cy: 760, rx: 210, ry: 70 },
    lantern: { x: 640, y: 690, scale: 0.8 },
    maple: { x: 640, y: 410, scale: 0.72 },
    moss: [
      { x: 170, y: 470, rx: 70, ry: 20 },
      { x: 560, y: 1375, rx: 100, ry: 24 },
    ],
    spots: [
      { x: 400, y: 580, scale: 1 },
      { x: 190, y: 960, scale: 1 },
      { x: 610, y: 960, scale: 1 },
      { x: 400, y: 1150, scale: 1.05 },
      { x: 180, y: 1300, scale: 1.05 },
      { x: 620, y: 1300, scale: 1.05 },
      { x: 175, y: 520, scale: 0.85 },
    ],
  },
}

export function spotsFor(count: number, layout: GardenLayout = 'wide'): Spot[] {
  return GARDEN_LAYOUTS[layout].spots.slice(0, Math.max(0, count))
}
