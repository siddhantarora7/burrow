import { describe, expect, it } from 'vitest'
import { burrowTitle } from '../lib/status'

const p = (name: string, state: Parameters<typeof burrowTitle>[0][number]['state']) => ({ name, state })

describe('burrowTitle', () => {
  it('names the pet that needs you first, so a background tab still answers "is it waiting on me?"', () => {
    expect(burrowTitle([p('mika', 'work'), p('jun', 'wave')])).toBe('jun needs you · burrow')
  })
  it('handles two and many waiting pets', () => {
    expect(burrowTitle([p('jun', 'wave'), p('mika', 'wave')])).toBe('jun and mika need you · burrow')
    expect(burrowTitle([p('a', 'wave'), p('b', 'wave'), p('c', 'wave')])).toBe('3 pets need you · burrow')
  })
  it('counts working pets when nobody is waiting', () => {
    expect(burrowTitle([p('mika', 'work'), p('ada', 'work'), p('jun', 'sleep')])).toBe('2 working · burrow')
  })
  it('is just the name when the garden is quiet', () => {
    expect(burrowTitle([p('ada', 'sleep')])).toBe('burrow')
    expect(burrowTitle([])).toBe('burrow')
  })
})
