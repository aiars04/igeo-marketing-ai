import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { BackgroundPaths } from '@/components/ui/background-paths'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'iGEO Marketing AI',
  description: 'Agente de Marketing — Cerebro iGEO',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${jakarta.variable} h-full`}>
      <body className="h-full antialiased">
        <BackgroundPaths />
        {children}
      </body>
    </html>
  )
}
