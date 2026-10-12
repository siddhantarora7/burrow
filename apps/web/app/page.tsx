import type { Metadata } from 'next'
import { Landing } from './Landing'

export const metadata: Metadata = {
  title: 'burrow · a tiny pet for your coding agent',
  description: 'a pixel pet that works while Claude Code runs and waves when it needs you, in a garden shared with your friends.',
}

export default function Home() {
  return <Landing />
}
