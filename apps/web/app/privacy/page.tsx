import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'privacy · burrow' }

const PAYLOAD = '{ "v": 1, "type": "stop", "at": 1791234567890, "session": "3f9a1c0e7b2d" }'

export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <Link href="/" className="font-display text-xl font-bold">burrow</Link>
      <h1 className="mt-10 font-display text-4xl font-bold tracking-tight">what your pet knows about you</h1>
      <p className="mt-4 text-lg opacity-80">almost nothing. each time Claude Code does something, the hook sends exactly this, and the server refuses anything else:</p>
      <pre className="chip chip-os mt-6 whitespace-pre-wrap break-words rounded-2xl p-5 font-mono text-sm">{PAYLOAD}</pre>
      <dl className="mt-8 grid gap-4 sm:grid-cols-[8rem_1fr]">
        <dt className="font-display font-bold">type</dt>
        <dd className="opacity-80">what happened: a prompt, a finished task, a request for your input, a session starting or ending.</dd>
        <dt className="font-display font-bold">at</dt>
        <dd className="opacity-80">when it happened.</dd>
        <dt className="font-display font-bold">session</dt>
        <dd className="opacity-80">a salted hash, so two Claude windows can be told apart. The salt never leaves your machine, so it can&apos;t be traced back.</dd>
      </dl>
      <h2 className="mt-12 font-display text-2xl font-bold">never sent</h2>
      <p className="mt-3 opacity-80">your prompts, Claude&apos;s replies, code, file paths, folder or repo names, tool names, or anything Claude reads or writes.</p>
      <h2 className="mt-12 font-display text-2xl font-bold">what the server works out</h2>
      <p className="mt-3 opacity-80">
        everything in the garden comes from those fields: your pet&apos;s state, how long your agent waited on you today, and the koban it earns (finished runs and quick answers). nothing else is collected to make that work.
      </p>
      <h2 className="mt-12 font-display text-2xl font-bold">see it yourself</h2>
      <p className="mt-3 opacity-80">
        run <code className="font-mono text-sm">npx burrow-pets privacy</code> to print the same list, or{' '}
        <code className="font-mono text-sm">npx burrow-pets uninstall</code> to remove the hooks and your local pet data.
      </p>
    </main>
  )
}
