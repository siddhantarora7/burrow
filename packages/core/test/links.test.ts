import { describe, expect, it } from 'vitest'
import { parseBurrowLink } from '../src/links'

describe('parseBurrowLink', () => {
  it.each([
    'https://burrow.vercel.app/b/abcdefgh12',
    'https://burrow.vercel.app/b/abcdefgh12/',
    'https://burrow.vercel.app/b/abcdefgh12?h=21.5',
    'https://burrow.vercel.app/b/abcdefgh12#claim=abcdefgh12.0123456789abcdef',
    'http://localhost:3000/b/ABCDEFGH12',
    'burrow.vercel.app/b/abcdefgh12',
    'abcdefgh12',
    '  abcdefgh12  ',
  ])('finds the burrow in %s', (link) => {
    expect(parseBurrowLink(link)).toBe('abcdefgh12')
  })
  it.each(['', 'https://x/b/short', 'https://x/p/abcdefgh12', 'abcdefghio', 'https://x/b/abcdefgh12345'])('rejects %j', (link) => {
    expect(parseBurrowLink(link)).toBeNull()
  })
})
