export default function Home() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col justify-center gap-5 px-6">
      <h1 className="font-display text-5xl font-bold tracking-tight">everyone&apos;s agents, one burrow.</h1>
      <p className="text-lg opacity-80">a tiny pet that reacts live to Claude Code, in a garden shared with your friends.</p>
      <code className="chip chip-os w-fit rounded-full px-5 py-3 font-mono text-sm">npx burrow-pets init</code>
    </main>
  )
}
