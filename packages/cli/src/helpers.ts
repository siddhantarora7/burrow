import { DEFAULT_COLOR, isPetColor, PET_COLORS, type PetColor, type Species } from '@burrow/core'

const COLORS = Object.keys(PET_COLORS) as PetColor[]

/** The burrow link that also signs this browser in, once, within 10 minutes. Fragments never reach a server. */
export const claimUrl = (webUrl: string, burrowId: string, claim: string) => `${webUrl}/b/${burrowId}#claim=${claim}`

/** "1 sakura   2 matcha   3 rice*   …", the default marked with *. */
export const colorMenu = (species: Species) => COLORS.map((c, i) => `${i + 1} ${c}${c === DEFAULT_COLOR[species] ? '*' : ''}`).join('   ')

/** Empty input takes the species colour; otherwise a menu number or a colour name. */
export function pickColor(input: string, species: Species): PetColor | null {
  const s = input.trim().toLowerCase()
  if (!s) return DEFAULT_COLOR[species]
  if (isPetColor(s)) return s
  return /^\d+$/.test(s) ? (COLORS[Number(s) - 1] ?? null) : null
}
