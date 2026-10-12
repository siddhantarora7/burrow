'use client'
import { useEffect, useRef } from 'react'
import { hash } from '@/lib/pixel/palette'

/**
 * Pixel stars for the landing sky, scattered like the garden's own: whole 2px squares at hashed spots,
 * dimmer toward the horizon. `twinkle` draws a sparser warm layer that the stylesheet fades in and out.
 */
export function Stars({ twinkle = false, className = '' }: { twinkle?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const draw = () => {
      const w = Math.ceil(c.clientWidth / 2), h = Math.ceil(c.clientHeight / 2)
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      const n = Math.round((w * h) / (twinkle ? 2600 : 700))
      for (let i = 0; i < n; i++) {
        const x = Math.floor(hash(i, twinkle ? 7 : 3) * w), y = Math.floor(hash(twinkle ? 11 : 5, i) * h)
        const fade = 1 - y / h
        if (hash(x, y) > fade) continue // fewer stars low in the sky
        ctx.fillStyle = twinkle ? '#ffe9a8' : hash(y, x) > 0.7 ? '#f1eee6' : 'rgba(241, 238, 230, 0.5)'
        ctx.fillRect(x, y, 1, 1)
      }
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(c)
    return () => ro.disconnect()
  }, [twinkle])
  return <canvas ref={ref} className={`pointer-events-none absolute inset-x-0 top-0 h-[70%] w-full [image-rendering:pixelated] ${twinkle ? 'twinkle' : ''} ${className}`} aria-hidden="true" />
}
