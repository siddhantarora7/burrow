import type { Metadata } from 'next'
import { Landing } from './Landing'

export const metadata: Metadata = {
  title: 'burrow · a tiny pet for your coding agent',
  description: 'a pixel pet for Claude Code. it waves when your agent needs you, in a garden you share with friends.',
}

export default function Home() {
  return <Landing />
}
