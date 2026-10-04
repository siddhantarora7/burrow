export const SPECIES = ['mochi', 'tofu', 'onigiri'] as const
export type Species = (typeof SPECIES)[number]

export const PET_COLORS = {
  sakura: '#EFA9BC',
  matcha: '#98B062',
  rice: '#F4EFE4',
  yuzu: '#F0C64E',
  sora: '#A9C8E8',
  fuji: '#BFAEDB',
} as const
export type PetColor = keyof typeof PET_COLORS

export const DEFAULT_COLOR: Record<Species, PetColor> = { mochi: 'sakura', tofu: 'matcha', onigiri: 'rice' }

export const isSpecies = (x: unknown): x is Species => typeof x === 'string' && (SPECIES as readonly string[]).includes(x)
export const isPetColor = (x: unknown): x is PetColor => typeof x === 'string' && Object.hasOwn(PET_COLORS, x)

/** Lowercase, single-spaced, 1-16 chars of a-z 0-9 space _ -, starting with a letter or digit. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const n = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  return /^[a-z0-9][a-z0-9 _-]{0,15}$/.test(n) ? n : null
}

/** "kiwi's burrow", "james' burrow". */
export function burrowName(petName: string): string {
  return `${petName}${petName.endsWith('s') ? "'" : "'s"} burrow`
}
