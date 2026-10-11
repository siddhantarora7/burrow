import { runHook } from './hook'

function readStdin(timeoutMs: number): Promise<string> {
  if (process.stdin.isTTY) return Promise.resolve('')
  return new Promise((resolve) => {
    let data = ''
    const done = () => resolve(data)
    const timer = setTimeout(done, timeoutMs)
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => {
      if (data.length < 1_000_000) data += c
    })
    process.stdin.on('end', () => {
      clearTimeout(timer)
      done()
    })
    process.stdin.on('error', done)
  })
}

readStdin(1000)
  .then((stdin) => runHook({ arg: process.argv[2] ?? '', stdin, env: process.env }))
  .catch(() => {})
  .finally(() => process.exit(0))
