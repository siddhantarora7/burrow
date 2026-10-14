import { describe, expect, it } from 'vitest'
import { parseWireEvent } from '../src/events'

const good = { v: 1, type: 'stop', at: 1791234567890, session: '3f9a1c0e7b2d' }

describe('parseWireEvent', () => {
  it('accepts the exact payload', () => {
    expect(parseWireEvent(good)).toEqual({ ok: true, value: good })
  })
  it('rejects any extra key, so the payload can never quietly widen', () => {
    const r = parseWireEvent({ ...good, cwd: '/Users/me/secret-repo' })
    expect(r).toEqual({ ok: false, error: 'unexpected keys: cwd' })
  })
  it.each([
    [null, 'body must be a JSON object'],
    [[], 'body must be a JSON object'],
    [{ ...good, v: 2 }, 'v must be 1'],
    [{ ...good, type: 'tool_use' }, 'unknown type'],
    [{ ...good, at: -1 }, 'at must be epoch ms'],
    [{ ...good, at: 1.5 }, 'at must be epoch ms'],
    [{ ...good, session: 'ABC' }, 'session must be 12 hex chars'],
    [{ v: 1, type: 'stop', at: 1 }, 'session must be 12 hex chars'],
  ])('rejects %j', (body, error) => {
    expect(parseWireEvent(body)).toEqual({ ok: false, error })
  })
})

describe('parseWireEvent: the opt-in usage key', () => {
  it.each(['stop', 'session_end'])('accepts usage on %s', (type) => {
    const body = { ...good, type, usage: { tokens: 1200, cost: 0.42 } }
    expect(parseWireEvent(body)).toEqual({ ok: true, value: body })
  })
  it('accepts an empty usage object', () => {
    expect(parseWireEvent({ ...good, usage: {} }).ok).toBe(true)
  })
  it.each([
    [{ ...good, type: 'prompt', usage: { tokens: 1 } }, 'usage only on stop or session_end'],
    [{ ...good, usage: { tokens: 1.5 } }, 'usage.tokens must be an integer up to 50M'],
    [{ ...good, usage: { tokens: -1 } }, 'usage.tokens must be an integer up to 50M'],
    [{ ...good, usage: { tokens: 50_000_001 } }, 'usage.tokens must be an integer up to 50M'],
    [{ ...good, usage: { cost: Number.NaN } }, 'usage.cost must be 0 to 500'],
    [{ ...good, usage: { cost: 501 } }, 'usage.cost must be 0 to 500'],
    [{ ...good, usage: { tokens: 5, extra: 1 } }, 'usage takes only tokens and cost'],
    [{ ...good, usage: [] }, 'usage takes only tokens and cost'],
  ])('rejects %j', (body, error) => {
    expect(parseWireEvent(body)).toEqual({ ok: false, error })
  })
})
