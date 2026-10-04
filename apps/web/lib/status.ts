import type { PetState } from '@burrow/core'

/** The tab title is a glance surface too: who needs you, else how many are working. */
export function burrowTitle(pets: ReadonlyArray<{ name: string; state: PetState }>): string {
  const waiting = pets.filter((p) => p.state === 'wave').map((p) => p.name)
  if (waiting.length === 1) return `${waiting[0]} needs you · burrow`
  if (waiting.length === 2) return `${waiting[0]} and ${waiting[1]} need you · burrow`
  if (waiting.length > 2) return `${waiting.length} pets need you · burrow`
  const working = pets.filter((p) => p.state === 'work').length
  return working ? `${working} working · burrow` : 'burrow'
}
