import type { Metadata } from 'next'
import { Geist_Mono, Zen_Kaku_Gothic_New, Zen_Maru_Gothic } from 'next/font/google'
import './globals.css'

const display = Zen_Maru_Gothic({ weight: ['500', '700'], subsets: ['latin'], variable: '--font-zen-maru' })
const body = Zen_Kaku_Gothic_New({ weight: ['400', '500', '700'], subsets: ['latin'], variable: '--font-zen-kaku' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'burrow',
  description: 'a tiny pet that reacts live to your coding agent, in a garden shared with your friends.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
