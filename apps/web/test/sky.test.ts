import { describe, expect, it } from 'vitest'
import { season, skyAt } from '../lib/sky'

describe('sky', () => {
  it('is night at 2am and 11pm, day at noon', () => {
    expect(skyAt(2).night).toBe(true)
    expect(skyAt(23).night).toBe(true)
    expect(skyAt(12).night).toBe(false)
  })
  it('returns hex colors for every quarter hour', () => {
    for (let h = 0; h < 24; h += 0.25) {
      const s = skyAt(h)
      expect(s.top).toMatch(/^#[0-9a-f]{6}$/)
      expect(s.bottom).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
  it('maps months to northern seasons', () => {
    expect(season(9)).toBe('autumn')
    expect(season(0)).toBe('winter')
    expect(season(3)).toBe('spring')
    expect(season(6)).toBe('summer')
  })
})
