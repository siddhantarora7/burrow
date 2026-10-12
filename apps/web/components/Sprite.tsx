'use client'
import { useEffect, useRef, useState } from 'react'
import type { PetColor, PetState, Species, Stage } from '@burrow/core'
import { colorsFor, FPS, FRAMES, GRID, petGrid, silhouette } from '@/lib/pixel/sprites'

/**
 * One pet sprite as chrome (the header mark, panels): 32 garden pixels drawn at `size` CSS px, pixelated.
 * `ink` draws an undiscovered form as a flat silhouette in that colour instead.
 */
export function Sprite({ species, color, stage = 'grown', state = 'idle', size = 32, ink, animate = false, className = '' }: {
  species: Species
  color: PetColor
  stage?: Stage
  state?: PetState
  size?: number
  ink?: string
  /** Loop the state's frames at its own rate (still with reduced motion). */
  animate?: boolean
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setFrame((f) => (f + 1) % FRAMES[state]), 1000 / FPS[state])
    return () => clearInterval(t)
  }, [animate, state])
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, GRID, GRID)
    const grid = petGrid(species, state, frame % FRAMES[state], false, stage)
    const colors = colorsFor(color)
    ;(ink ? silhouette(grid) : grid).forEach((row, y) =>
      row.forEach((v, x) => {
        if (!v) return
        ctx.fillStyle = ink ?? colors[v]!
        ctx.fillRect(x, y, 1, 1)
      }),
    )
  }, [species, color, stage, state, ink, frame])
  return <canvas ref={ref} width={GRID} height={GRID} style={{ width: size, height: size }} className={`[image-rendering:pixelated] ${className}`} aria-hidden="true" />
}
