import { parseBurrowLink } from '@burrow/core'

/** Where a pasted garden link (or bare id, or one-time sign-in link) should take you, or null. */
export function gardenHref(input: string): string | null {
  const id = parseBurrowLink(input.split('#')[0]!)
  if (!id) return null
  const claim = /#claim=([^\s#]+)/.exec(input.trim())?.[1]
  return `/b/${id}${claim ? `#claim=${claim}` : ''}`
}
