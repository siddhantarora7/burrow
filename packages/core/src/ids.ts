// Crockford base32, lowercase: no i, l, o, u.
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'
const CHARS = '[0-9a-hjkmnp-tv-z]'
const ID_RE = new RegExp(`^${CHARS}{10}$`)
export const SECRET_LEN = 24
const SECRET_RE = new RegExp(`^${CHARS}{${SECRET_LEN}}$`)

export function newId(len = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let s = ''
  for (const b of bytes) s += ALPHABET[b & 31]
  return s
}

export function isId(x: unknown): x is string {
  return typeof x === 'string' && ID_RE.test(x)
}

export function parseToken(token: string | null | undefined): { petId: string; secret: string } | null {
  if (!token) return null
  const i = token.indexOf('.')
  if (i < 0) return null
  const petId = token.slice(0, i)
  const secret = token.slice(i + 1)
  return isId(petId) && SECRET_RE.test(secret) ? { petId, secret } : null
}
