import { describe, expect, it } from 'vitest'
import { PET_STATES } from '@burrow/core'
import { burrowTitle, tagLabel, VERB } from '../lib/status'

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

describe('tagLabel', () => {
  it.each(PET_STATES)('%s: the accessible name starts with the text the tag shows (WCAG 2.5.3)', (state) => {
    const label = tagLabel('ada', VERB[state], 'last update 2m ago')
    expect(label.startsWith(`ada ${VERB[state]}`)).toBe(true)
    expect(label).toContain('last update 2m ago')
  })
  it('works for the quiet verb too', () => {
    expect(tagLabel('kiwi', 'quiet', 'quiet for 3m, maybe interrupted')).toBe('kiwi quiet: quiet for 3m, maybe interrupted. press to boop.')
  })
})
