import type { Metadata } from 'next'
import { Inter, Syne } from 'next/font/google'
import './globals.css'

/* ─── Body / UI font ─── */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

/* ─── Display / headings (opt-in via .font-display / .section-title) ─── */
const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'iGEO Marketing AI',
  description: 'Agente de Marketing — Cerebro iGEO',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${syne.variable} h-full`}>
      <body className="h-full bg-[var(--bg)] text-[var(--text)] antialiased">
        {children}
      </body>
    </html>
  )
}
