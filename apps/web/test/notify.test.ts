import { afterEach, describe, expect, it, vi } from 'vitest'
import { notify } from '../lib/notify'

describe('notify', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('never throws where the constructor is illegal (Android Chrome), so the garden survives an alert', () => {
    vi.stubGlobal('Notification', class { static permission = 'granted'; constructor() { throw new TypeError('Illegal constructor') } })
    expect(() => notify('kiwi needs you', 'your agent is waiting on you')).not.toThrow()
    expect(notify('kiwi needs you', 'your agent is waiting on you')).toBe(false)
  })
  it('shows a notification when allowed', () => {
    const shown: string[] = []
    vi.stubGlobal('Notification', class { static permission = 'granted'; onclick: unknown; constructor(t: string) { shown.push(t) } close() {} })
    expect(notify('kiwi needs you', 'body')).toBe(true)
    expect(shown).toEqual(['kiwi needs you'])
  })
  it('does nothing without permission or support', () => {
    vi.stubGlobal('Notification', class { static permission = 'denied' })
    expect(notify('t', 'b')).toBe(false)
    vi.stubGlobal('Notification', undefined)
    expect(notify('t', 'b')).toBe(false)
  })
})
