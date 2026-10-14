import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { Gaegu, Geist_Mono, Zen_Maru_Gothic } from 'next/font/google'
import './globals.css'

const display = Zen_Maru_Gothic({ weight: ['500', '700'], subsets: ['latin'], variable: '--font-zen-maru' })
// UI and body text use the system face (crisp, centred in pills); Gaegu writes the landing page's margin notes
const hand = Gaegu({ weight: ['700'], subsets: ['latin'], variable: '--font-gaegu' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

const description = 'a pixel pet for Claude Code that waves when your agent is waiting on you. friends can share the garden.'

export const metadata: Metadata = {
  // share cards need absolute image URLs: Vercel provides the production host at build time
  metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000'),
  title: 'burrow',
  description,
  openGraph: { title: 'burrow', description, siteName: 'burrow', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'burrow', description },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${hand.variable} ${mono.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
