import { appendFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readTokens, usageFor } from '../src/usage'

const line = (id: string, input: number, output: number, extra = {}) =>
  JSON.stringify({ type: 'assistant', message: { id, usage: { input_tokens: input, cache_creation_input_tokens: 10, cache_read_input_tokens: 100, output_tokens: output, ...extra } } }) + '\n'

async function transcript(content: string) {
  const dir = await mkdtemp(join(tmpdir(), 'burrow-usage-'))
  const path = join(dir, 't.jsonl')
  await writeFile(path, content)
  return path
}

describe('readTokens: what Claude Code recorded, summed locally', () => {
  it('sums all four token counts once per message id', async () => {
    const path = await transcript(line('m1', 2, 50) + line('m1', 2, 50) + JSON.stringify({ type: 'user' }) + '\n' + line('m2', 1, 9))
    const r = await readTokens(path, null)
    expect(r.tokens).toBe(2 + 10 + 100 + 50 + (1 + 10 + 100 + 9))
    expect(r.st.lastId).toBe('m2')
  })
  it('reads only what was appended, and leaves a partial last line for next time', async () => {
    const path = await transcript(line('m1', 2, 50))
    const first = await readTokens(path, null)
    await appendFile(path, line('m1', 2, 50) + line('m2', 0, 5) + '{"type":"assist')
    const second = await readTokens(path, first.st)
    expect(second.tokens).toBe(0 + 10 + 100 + 5)
    await appendFile(path, 'ant"}\n')
    expect((await readTokens(path, second.st)).tokens).toBe(0)
  })
  it('returns nothing for a missing file', async () => {
    const r = await readTokens('/nope/t.jsonl', { offset: 7 })
    expect(r).toEqual({ tokens: 0, st: { offset: 7 } })
  })
  it('starts at the end of a transcript over 20 MB', async () => {
    const path = await transcript(line('m1', 1, 1) + 'x'.repeat(20_000_001) + '\n')
    expect((await readTokens(path, null)).tokens).toBe(0)
  })
})

describe('usageFor: the increase since the last event', () => {
  async function home() {
    const h = await mkdtemp(join(tmpdir(), 'burrow-home-'))
    await mkdir(join(h, 'sessions'), { recursive: true })
    return h
  }
  it('sends tokens and the status line cost increase, then nothing when unchanged', async () => {
    const h = await home()
    const path = await transcript(line('m1', 2, 50))
    await writeFile(join(h, 'sessions', 'abcdefabcdef.cost'), '1.25')
    expect(await usageFor(h, 'abcdefabcdef', path)).toEqual({ tokens: 162, cost: 1.25 })
    expect(await usageFor(h, 'abcdefabcdef', path)).toBeUndefined()
    await writeFile(join(h, 'sessions', 'abcdefabcdef.cost'), '2')
    expect(await usageFor(h, 'abcdefabcdef', path)).toEqual({ cost: 0.75 })
    expect(JSON.parse(await readFile(join(h, 'sessions', 'abcdefabcdef.usage.json'), 'utf8')).costSent).toBe(2)
  })
  it('never sends a negative cost', async () => {
    const h = await home()
    await writeFile(join(h, 'sessions', 'abcdefabcdef.cost'), '3')
    await usageFor(h, 'abcdefabcdef', undefined)
    await writeFile(join(h, 'sessions', 'abcdefabcdef.cost'), '1')
    expect(await usageFor(h, 'abcdefabcdef', undefined)).toBeUndefined()
  })
})
