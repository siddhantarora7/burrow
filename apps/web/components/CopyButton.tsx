'use client'
import { useEffect, useState } from 'react'
import { Check, Copy } from './icons'

/** A copy button that says what it copied for two seconds. */
export function CopyButton({ text, label = 'copy', className = '' }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <button
      type="button"
      className={`pill-btn chip-solid font-bold ${className}`}
      onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {})}
    >
      {copied ? <Check /> : <Copy />}
      <span className="lbl" aria-live="polite">{copied ? 'copied' : label}</span>
    </button>
  )
}
