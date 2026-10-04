import { describe, expect, it } from 'vitest'
import { isId, newId, parseToken, SECRET_LEN } from '../src/ids'

describe('ids', () => {
  it('makes 10-char crockford ids', () => {
    for (let i = 0; i < 200; i++) expect(isId(newId())).toBe(true)
  })
  it('never uses ambiguous letters', () => {
    const s = Array.from({ length: 300 }, () => newId(24)).join('')
    expect(s).not.toMatch(/[ilou]/)
  })
  it('parses petId.secret tokens', () => {
    const petId = newId(), secret = newId(SECRET_LEN)
    expect(parseToken(`${petId}.${secret}`)).toEqual({ petId, secret })
  })
  it.each([null, undefined, '', 'nodot', 'abc.def', `${'a'.repeat(10)}.short`])('rejects %j', (t) => {
    expect(parseToken(t)).toBeNull()
  })
})
