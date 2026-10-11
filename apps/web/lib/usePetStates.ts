'use client'
import { useEffect, useMemo, useState } from 'react'
import { derive, type DeriveResult, type Member } from '@burrow/core'

/** Derives every member's state on the server's clock and re-renders exactly when one could change. */
export function usePetStates(members: Member[], offset: number): Map<string, DeriveResult> {
  const [tick, setTick] = useState(0)
  const results = useMemo(() => {
    const now = Date.now() + offset
    const stops = new Map(members.map((m) => [m.petId, m.events.filter((e) => e.type === 'stop').map((e) => e.t)]))
    return new Map(
      members.map((m) => {
        const friendStops = members.filter((o) => o.petId !== m.petId).flatMap((o) => stops.get(o.petId) ?? [])
        return [m.petId, derive({ events: m.events, friendStops, now })]
      }),
    )
    // tick forces a recompute when a timer fires
  }, [members, offset, tick])

  useEffect(() => {
    const next = Math.min(...[...results.values()].map((r) => r.nextChangeAt ?? Infinity))
    if (!Number.isFinite(next)) return
    const t = setTimeout(() => setTick((n) => n + 1), Math.max(16, next - (Date.now() + offset)))
    return () => clearTimeout(t)
  }, [results, offset])

  return results
}
