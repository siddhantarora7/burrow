import type { PetState } from '@burrow/core'

/** What each pet is doing, as its tag says it. */
export const VERB: Record<PetState, string> = {
  idle: 'hanging out', eat: 'eating', wave: 'needs you', work: 'working', sleep: 'asleep', cheer: 'cheering',
}

/** The tab title is a glance surface too: who needs you, else how many are working. */
export function burrowTitle(pets: ReadonlyArray<{ name: string; state: PetState }>): string {
  const waiting = pets.filter((p) => p.state === 'wave').map((p) => p.name)
  if (waiting.length === 1) return `${waiting[0]} needs you · burrow`
  if (waiting.length === 2) return `${waiting[0]} and ${waiting[1]} need you · burrow`
  if (waiting.length > 2) return `${waiting.length} pets need you · burrow`
  const working = pets.filter((p) => p.state === 'work').length
  return working ? `${working} working · burrow` : 'burrow'
}

/**
 * A tag's accessible name. It starts with exactly what the tag shows ("ada needs you"), so speech
 * users can say what they see (WCAG 2.5.3), then adds the detail and what pressing does.
 */
export function tagLabel(name: string, verb: string, detail: string): string {
  return `${name} ${verb}: ${detail}. press to boop.`
}
