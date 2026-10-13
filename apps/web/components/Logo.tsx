/**
 * The burrow mark: a mochi drawn in whole pixels. The body takes `currentColor`; the eyes and smile are
 * holes, so the mark reads on any background. Two lids close over the eyes now and then (see .logo-lid).
 */
const GRID = [
  '      XXXXXX      ',
  '    XXXXXXXXXX    ',
  '   XXXXXXXXXXXX   ',
  '  XXXXXXXXXXXXXX  ',
  ' XXXX.XXXXXX.XXXX ',
  ' XXXX.XXXXXX.XXXX ',
  'XXXPPXX.XX.XXPPXXX',
  'XXXXXXXX..XXXXXXXX',
  'XXXXXXXXXXXXXXXXXX',
  ' XXXXXXXXXXXXXXXX ',
]
export const LOGO_W = GRID[0]!.length
export const LOGO_H = GRID.length

/** One path per colour: each row's runs of that cell as h/v rectangles. */
function runs(cell: string) {
  let d = ''
  GRID.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      if (row[x] !== cell) { x++; continue }
      let n = 0
      while (row[x + n] === cell) n++
      d += `M${x} ${y}h${n}v1h-${n}z`
      x += n
    }
  })
  return d
}
const BODY = runs('X')
const BLUSH = runs('P')

export function Logo({ size = 20, blink = true, className = '' }: { size?: number; blink?: boolean; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_W} ${LOGO_H}`}
      width={(size * LOGO_W) / LOGO_H}
      height={size}
      shapeRendering="crispEdges"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path d={BODY} fill="currentColor" />
      <path d={BLUSH} fill="#f4a3bc" />
      {blink && <path className="logo-lid" d="M5 4h1v1h-1zM12 4h1v1h-1z" fill="currentColor" />}
    </svg>
  )
}
