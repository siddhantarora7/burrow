import { describe, expect, it } from 'vitest'
import { claimInHash } from '../lib/me'

describe('claimInHash', () => {
  it('reads the one-time claim from the fragment', () => {
    expect(claimInHash('#claim=abcdefgh12.0123456789abcdef')).toBe('abcdefgh12.0123456789abcdef')
  })
  it('ignores other fragments', () => {
    expect(claimInHash('')).toBeNull()
    expect(claimInHash('#top')).toBeNull()
    expect(claimInHash('#claim=')).toBeNull()
  })
})
