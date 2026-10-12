import { describe, expect, it } from 'vitest'
import { parseBurrowLink } from '@burrow/core'
import { INIT, inviteCommand } from '../lib/commands'

describe('inviteCommand', () => {
  it('is init with this garden link, which the CLI reads back as the same burrow', () => {
    const cmd = inviteCommand('https://burrow-taupe.vercel.app', 'k3x9q2mbw7')
    expect(cmd).toBe('npx burrow-pets init https://burrow-taupe.vercel.app/b/k3x9q2mbw7')
    expect(parseBurrowLink(cmd.slice(INIT.length + 1))).toBe('k3x9q2mbw7')
  })

  it('drops a trailing slash on the origin', () => {
    expect(inviteCommand('http://localhost:3000/', 'abc')).toBe('npx burrow-pets init http://localhost:3000/b/abc')
  })
})
