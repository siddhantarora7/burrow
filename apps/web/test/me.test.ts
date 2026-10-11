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

import { afterEach, vi } from 'vitest'
import { readMe, redeemClaimInUrl } from '../lib/me'

describe('redeemClaimInUrl', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('a second caller (React re-running the effect) waits for the first redemption instead of racing it', async () => {
    const store = new Map<string, string>()
    const loc = { hash: '#claim=abcdefgh12.0123456789abcdef', pathname: '/b/zzzzzzzzzz', search: '' }
    let answer!: (r: Response) => void
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) })
    vi.stubGlobal('location', loc)
    vi.stubGlobal('history', { replaceState: () => (loc.hash = '') })
    vi.stubGlobal('fetch', () => new Promise<Response>((r) => (answer = r)))
    const first = redeemClaimInUrl('http://api')
    const second = redeemClaimInUrl('http://api') // the fragment is already gone
    let secondDone = false
    void second.then(() => (secondDone = true))
    await Promise.resolve()
    expect(secondDone).toBe(false)
    answer(new Response(JSON.stringify({ petId: 'abcdefgh12', token: 'abcdefgh12.secret' })))
    await Promise.all([first, second])
    expect(readMe()).toEqual({ petId: 'abcdefgh12', token: 'abcdefgh12.secret' })
  })
})
