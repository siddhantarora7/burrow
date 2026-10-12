import type { Metadata } from 'next'
import { DemoGarden } from './DemoGarden'

export const metadata: Metadata = { title: 'demo garden · burrow', description: 'A synthetic burrow: pets reacting to made-up agent activity.' }

/** `?n=` pets (up to 24), `?h=` an hour to preview, `?embed=1` the garden alone for the landing page's frame. */
export default async function Demo({ searchParams }: { searchParams: Promise<{ n?: string; embed?: string }> }) {
  const { n, embed } = await searchParams
  return <DemoGarden count={Number(n) || 6} embed={embed === '1'} />
}
