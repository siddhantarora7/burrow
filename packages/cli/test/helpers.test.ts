import { describe, expect, it } from 'vitest'
import { claimUrl, colorMenu, pickColor } from '../src/helpers'

describe('claimUrl', () => {
  it('puts the one-time claim in the fragment, which never reaches a server', () => {
    expect(claimUrl('https://burrow.vercel.app', 'abcdefgh12', 'zzzzzzzzzz.0123456789abcdef')).toBe('https://burrow.vercel.app/b/abcdefgh12#claim=zzzzzzzzzz.0123456789abcdef')
  })
})

describe('pickColor', () => {
  it('defaults to the species colour on empty input', () => {
    expect(pickColor('', 'tofu')).toBe('matcha')
  })
  it('takes a number or a name', () => {
    expect(pickColor('4', 'mochi')).toBe('yuzu')
    expect(pickColor(' Sora ', 'mochi')).toBe('sora')
  })
  it.each(['9', '0', 'neon'])('rejects %j', (s) => expect(pickColor(s, 'mochi')).toBeNull())
})

describe('colorMenu', () => {
  it('numbers every colour and marks the default', () => {
    expect(colorMenu('onigiri')).toBe('1 sakura   2 matcha   3 rice*   4 yuzu   5 sora   6 fuji   7 kinako')
    expect(colorMenu('dorayaki')).toContain('7 kinako*')
  })
})

import { SPECIES } from '@burrow/core'
import { FACE } from '../src/ui'

describe('FACE', () => {
  it('has a face for every species, each one different', () => {
    expect(SPECIES.every((s) => typeof FACE[s] === 'string' && FACE[s].length > 0)).toBe(true)
    expect(new Set(SPECIES.map((s) => FACE[s])).size).toBe(SPECIES.length)
  })
})
