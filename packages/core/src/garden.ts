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

/** Integer scale from CSS pixels to garden pixels: about 190 garden pixels tall on landscape screens, 130 wide on portrait ones. */
export function pixelScale(vw: number, vh: number): number {
  return Math.max(2, vw > vh ? Math.round(vh / 190) : Math.round(vw / 130))
}

/** Minimum horizontal distance between pets in the same row, in garden pixels, so name tags (about 150 CSS px) never overlap. */
export function tagGap(scale: number): number {
  return Math.max(26, Math.ceil(150 / scale))
}

/**
 * Garden pixels to keep free at the bottom of the first screen, so name tags clear the fixed
 * command pill (and, on phones, the hint chip stacked above it).
 */
export function bottomReserve(scale: number, portrait: boolean): number {
  return Math.ceil((portrait ? 130 : 70) / scale) + 12
}

const ROW = 36 // a pet (30 px) plus its tag never reaches the row below

/**
 * The zen garden for a `W`x`H` garden-pixel screen and `count` members. Spots come from one fixed,
 * preference-ordered list of candidates (focal spot first), each accepted only if it is on the
 * gravel, off the pond, and clear of every pet already placed. Deterministic, and earlier members
 * keep their spots as others join. Rows past the first screen extend the gravel (the page scrolls).
 */
export function layoutGarden(W: number, H: number, count: number, gap = 26, reserve = 28): GardenLayout {
  const portrait = H > W
  const n = Math.max(0, Math.min(count, MAX_MEMBERS))
  const horizon = portrait ? Math.round(Math.min(96, H * 0.27)) : Math.round(Math.min(92, H * 0.47))
  const gravelTop = horizon + 17
  const pond = portrait
    ? // a lone pet sits front and centre mid-screen; larger burrows lift the pond to make room below
      { cx: Math.round(W * 0.5), cy: Math.round(gravelTop + (H - gravelTop) * (n <= 2 ? 0.45 : 0.32)), rx: Math.round(Math.min(46, W * 0.3)), ry: 12 }
    : { cx: Math.round(W * 0.53), cy: Math.round(gravelTop + Math.max(18, (H - gravelTop) * 0.3)), rx: Math.round(Math.min(48, W * 0.15)), ry: 11 }
  // the last on-screen row keeps its name tag clear of the fixed chips at the bottom
  const front = H - reserve
  const pondFront = pond.cy + pond.ry

  const handpicked: Array<[number, number]> = portrait
    ? [[W * 0.5, Math.min(front, pondFront + 22)], [W * 0.25, pond.cy - pond.ry - 14], [W * 0.75, pond.cy - pond.ry - 14]]
    : [[W * 0.5, Math.min(front, pondFront + 22)], [W * 0.18, pond.cy], [W * 0.84, pond.cy - 6], [W * 0.3, front], [W * 0.72, front]]

  // the 32 px sprite and half a name tag must stay on screen
  const margin = Math.max(16, gap / 2)
  const usable = W - 2 * margin
  const perRow = Math.max(1, Math.floor(usable / gap) + 1)
  const spacing = perRow > 1 ? usable / (perRow - 1) : 0
  const rowXs = (row: number) =>
    row % 2 && perRow > 1
      ? Array.from({ length: perRow - 1 }, (_, i) => margin + spacing * (i + 0.5))
      : Array.from({ length: perRow }, (_, i) => (perRow > 1 ? margin + spacing * i : W / 2))

  const ok = (x: number, y: number, placed: Array<[number, number]>) => {
    if (x < margin || x > W - margin || y < gravelTop + 12) return false
    const dx = (x - pond.cx) / (pond.rx + 12), dy = (y - pond.cy) / (pond.ry + 8)
    if (dx * dx + dy * dy <= 1) return false
    return placed.every(([px, py]) => Math.abs(py - y) >= ROW || Math.abs(px - x) >= gap)
  }

  const spots: Array<[number, number]> = []
  const tryAdd = (x: number, y: number) => {
    const p: [number, number] = [Math.round(x), Math.round(y)]
    if (spots.length < n && ok(p[0], p[1], spots)) spots.push(p)
  }
  for (const [x, y] of handpicked) tryAdd(x, y)
  // on-screen rows below the pond, then rows past the first screen
  const firstRow = Math.min(front, pondFront + 22)
  let lastRow = firstRow
  for (let y = firstRow, row = 0; y <= front && spots.length < n; y += ROW, row++) {
    for (const x of rowXs(row)) tryAdd(x, y)
    lastRow = y
  }
  // past the first screen: never in the reserved strip, always below the fold
  const below = Math.max(lastRow + ROW, H + 4)
  for (let k = 0, row = 1; spots.length < n; k++, row++) for (const x of rowXs(row)) tryAdd(x, below + ROW * k)

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
