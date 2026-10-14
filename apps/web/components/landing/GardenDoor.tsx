'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { gardenHref } from '@/lib/door'
import { ArrowRight, Close } from '@/components/icons'

/**
 * "my garden" in the nav. A browser that has opened its own garden signed in links straight there;
 * any other browser gets a small door: paste your garden link (or the sign-in link `open` prints).
 */
export function GardenDoor({ className }: { className: string }) {
  const [home, setHome] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [bad, setBad] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    try {
      setHome(localStorage.getItem('burrow:home'))
    } catch {
      // storage blocked: the door still works
    }
  }, [])
  useEffect(() => {
    if (open && ref.current && !ref.current.open) ref.current.showModal()
  }, [open])

  if (home) return <Link href={`/b/${home}`} className={className}>my garden</Link>

  const go = (e: React.FormEvent) => {
    e.preventDefault()
    const href = gardenHref(value)
    if (!href) return setBad(true)
    location.assign(href)
  }
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>my garden</button>
      {open && (
        <dialog
          ref={ref}
          onClose={() => setOpen(false)}
          onClick={(e) => e.target === ref.current && ref.current.close()}
          aria-labelledby="door-title"
          className="m-auto w-[min(92vw,26rem)] whitespace-normal rounded-3xl bg-white p-6 text-left font-sans font-normal text-[#26241f] shadow-[0_30px_80px_-20px_rgba(38,36,31,0.45)] backdrop:bg-[#26241f]/30 backdrop:backdrop-blur-[2px]"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="door-title" className="font-display text-xl font-bold tracking-[-0.02em]">go to your garden</h2>
            <button type="button" onClick={() => ref.current?.close()} className="-mr-2 -mt-1 flex size-8 items-center justify-center rounded-full hover:bg-[#26241f]/[0.06]" aria-label="close">
              <Close size={18} />
            </button>
          </div>
          <form onSubmit={go} className="mt-4">
            <label htmlFor="door-link" className="text-[14px] text-[var(--muted)]">paste your garden link, or the sign-in link from <code className="font-mono text-[13px]">npx burrow-pets open</code></label>
            <div className="mt-2 flex items-center gap-2 rounded-full border border-[#26241f]/15 bg-[#f7f4ec] p-1 pl-4 focus-within:border-[#26241f]/40">
              <input
                id="door-link"
                autoFocus
                value={value}
                onChange={(e) => (setValue(e.target.value), setBad(false))}
                placeholder="burrow-taupe.vercel.app/b/…"
                className="min-w-0 flex-1 bg-transparent font-mono text-[13px] outline-none"
                aria-invalid={bad}
                aria-describedby="door-help"
              />
              <button type="submit" className="flex h-9 items-center gap-1.5 rounded-full bg-[#26241f] px-4 text-[14px] font-semibold text-[#f7f4ec]" aria-label="open garden">
                open <ArrowRight size={15} />
              </button>
            </div>
            <p id="door-help" className={`mt-3 text-[13px] ${bad ? 'text-[#c0392b]' : 'text-[var(--muted)]'}`}>
              {bad ? "that doesn't look like a garden link." : <>lost it? <code className="font-mono text-[12px]">npx burrow-pets status</code> prints it.</>}
            </p>
          </form>
        </dialog>
      )}
    </>
  )
}
