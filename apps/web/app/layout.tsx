import type { Metadata } from 'next'
import { Geist_Mono, Zen_Kaku_Gothic_New, Zen_Maru_Gothic } from 'next/font/google'
import './globals.css'

const display = Zen_Maru_Gothic({ weight: ['500', '700'], subsets: ['latin'], variable: '--font-zen-maru' })
const body = Zen_Kaku_Gothic_New({ weight: ['400', '500', '700'], subsets: ['latin'], variable: '--font-zen-kaku' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

const description = 'a pixel pet for Claude Code that waves when your agent is waiting on you, in a garden shared with your friends.'

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
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
