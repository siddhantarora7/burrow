import type { Metadata } from 'next'
import { DemoGarden } from './DemoGarden'

export const metadata: Metadata = { title: 'demo garden · burrow', description: 'A synthetic burrow: pets reacting to made-up agent activity.' }

export default async function Demo({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const { n } = await searchParams
  return <DemoGarden count={Number(n) || 6} />
}
