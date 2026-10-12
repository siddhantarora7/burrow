'use client'
import { useEffect, useRef } from 'react'
import type { PetColor, PetState, Species, Stage } from '@burrow/core'
import { colorsFor, GRID, petGrid, silhouette } from '@/lib/pixel/sprites'

/**
 * One pet sprite as chrome (the header mark, panels): 32 garden pixels drawn at `size` CSS px, pixelated.
 * `ink` draws an undiscovered form as a flat silhouette in that colour instead.
 */
export function Sprite({ species, color, stage = 'grown', state = 'idle', size = 32, ink, className = '' }: {
  species: Species
  color: PetColor
  stage?: Stage
  state?: PetState
  size?: number
  ink?: string
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, GRID, GRID)
    const grid = petGrid(species, state, 0, false, stage)
    const colors = colorsFor(color)
    ;(ink ? silhouette(grid) : grid).forEach((row, y) =>
      row.forEach((v, x) => {
        if (!v) return
        ctx.fillStyle = ink ?? colors[v]!
        ctx.fillRect(x, y, 1, 1)
      }),
    )
  }, [species, color, stage, state, ink])
  return <canvas ref={ref} width={GRID} height={GRID} style={{ width: size, height: size }} className={`[image-rendering:pixelated] ${className}`} aria-hidden="true" />
}
