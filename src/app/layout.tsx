import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { RegistrarSW } from '@/components/RegistrarSW'
import './globals.css'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Gestão de Visitas',
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#0b1220',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        {children}
        <RegistrarSW />
      </body>
    </html>
  )
}
