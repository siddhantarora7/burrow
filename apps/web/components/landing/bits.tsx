'use client'
import type { ReactNode } from 'react'
import { CopyButton } from '@/components/BurrowView'
import { Logo, LOGO_H } from '@/components/Logo'
import { INIT } from '@/lib/commands'

export const REPO = 'https://github.com/siddhantarora7/burrow'

/** The logo and the name, set as one lockup. `size` is the name's font size in px. */
export function Wordmark({ size, className = '' }: { size: number; className?: string }) {
  return (
    <span className={`inline-flex items-center font-display font-bold leading-none tracking-[-0.045em] ${className}`} style={{ fontSize: size, gap: size * 0.26 }}>
      {/* whole screen pixels per logo pixel keep its edges crisp */}
      <Logo size={Math.round((size * 0.82) / LOGO_H) * LOGO_H} />
      <span className="-translate-y-[0.06em]">burrow</span>
    </span>
  )
}

/** The install command, raised like a key, with its copy button. */
export function Command() {
  return (
    <div className="raised flex h-14 w-fit max-w-full items-center gap-3 rounded-full py-1 pl-6 pr-2">
      <span className="select-none font-mono text-[15px] opacity-40" aria-hidden="true">$</span>
      <code className="truncate font-mono text-[15px] leading-none">{INIT}</code>
      <CopyButton text={INIT} className="h-10 px-4 text-[13px]" />
    </div>
  )
}

/** A note in the margin, in a hand, with a drawn arrow. `dir` is where the arrow points. */
export function Note({ children, dir = 'up-right', className = '' }: { children: ReactNode; dir?: 'up-right' | 'up-left' | 'down-right' | 'down-left'; className?: string }) {
  const flip = { 'up-right': '', 'up-left': '-scale-x-100', 'down-right': '-scale-y-100', 'down-left': '-scale-100' }[dir]
  const arrow = (
    <svg viewBox="0 0 48 44" className={`h-9 w-10 shrink-0 ${flip}`} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 40c14 1 27-6 33-31" />
      <path d="M29 15l8-8 5 10" />
    </svg>
  )
  const left = dir.endsWith('left')
  return (
    <span className={`hand pointer-events-none inline-flex items-end gap-1 text-[22px] leading-none text-[#55514a] ${left ? 'flex-row-reverse' : ''} ${className}`} aria-hidden="true">
      <span className="pb-1">{children}</span>
      {arrow}
    </span>
  )
}
