import { describe, expect, it } from 'vitest'
import { gardenHref } from '../lib/door'

describe('gardenHref: from whatever you paste to your garden', () => {
  it('takes a garden link, a bare id, or a link with spaces and capitals', () => {
    expect(gardenHref('https://burrow-taupe.vercel.app/b/cdwytsy9er')).toBe('/b/cdwytsy9er')
    expect(gardenHref('cdwytsy9er')).toBe('/b/cdwytsy9er')
    expect(gardenHref('  HTTPS://burrow-taupe.vercel.app/b/CDWYTSY9ER/  ')).toBe('/b/cdwytsy9er')
  })
  it('keeps a sign-in link\'s claim, so pasting it signs you in too', () => {
    expect(gardenHref('https://burrow-taupe.vercel.app/b/cdwytsy9er#claim=cmzajs8dhr.x859tgmyrewx8xy8')).toBe('/b/cdwytsy9er#claim=cmzajs8dhr.x859tgmyrewx8xy8')
  })
  it('refuses anything else', () => {
    expect(gardenHref('')).toBeNull()
    expect(gardenHref('https://example.com/hello')).toBeNull()
  })
})
