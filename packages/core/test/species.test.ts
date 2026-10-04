import { describe, expect, it } from 'vitest'
import { cleanName, DEFAULT_COLOR, PET_COLORS, SPECIES } from '../src/species'

describe('species', () => {
  it('has a default color for every species', () => {
    for (const s of SPECIES) expect(PET_COLORS[DEFAULT_COLOR[s]]).toMatch(/^#[0-9A-F]{6}$/)
  })
  it.each([
    ['  Kiwi ', 'kiwi'],
    ['mr   bean', 'mr bean'],
    ['a', 'a'],
    ['sixteen-chars-ok', 'sixteen-chars-ok'],
  ])('cleans %j', (raw, out) => expect(cleanName(raw)).toBe(out))
  it.each(['', '   ', '-dash', 'seventeen-chars-x', 'emoji🙂', 42, null])('rejects %j', (raw) => {
    expect(cleanName(raw)).toBeNull()
  })
})

describe('isPetColor', () => {
  it('accepts palette names only, not inherited object keys', async () => {
    const { isPetColor } = await import('../src/species')
    expect(isPetColor('sora')).toBe(true)
    expect(isPetColor('toString')).toBe(false)
    expect(isPetColor('__proto__')).toBe(false)
  })
})
