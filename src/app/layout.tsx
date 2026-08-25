import type { Metadata, Viewport } from 'next'
import { Barlow, Barlow_Condensed } from 'next/font/google'
import { RegistrarSW } from '@/components/RegistrarSW'
import './globals.css'

/**
 * Barlow nasceu do vocabulário de sinalização rodoviária — placa de estrada,
 * faixa, painel. É a família certa para quem passa o dia dirigindo entre
 * clientes: a forma das letras já é a que ele lê na rua.
 *
 * A versão condensada carrega os números e os nomes de cliente, onde a largura
 * é escassa e a leitura é de relance.
 */
const barlow = Barlow({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow-condensed',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Visitas · Alta Performance',
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#0f1e2b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="pt-BR"
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-nevoa text-asfalto">
        {children}
        <RegistrarSW />
      </body>
    </html>
  )
}
