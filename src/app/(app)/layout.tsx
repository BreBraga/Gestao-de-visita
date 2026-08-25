import Link from 'next/link'
import { exigirUsuario } from '@/lib/auth/atual'
import { BotaoSair } from '@/components/BotaoSair'

export const dynamic = 'force-dynamic'

export default async function LayoutApp({ children }: LayoutProps<'/'>) {
  const u = await exigirUsuario()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/kanban" className="font-semibold">
          Visitas
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {u.papel === 'gestor' && (
            <Link href="/admin" className="text-slate-600">
              Admin
            </Link>
          )}
          <span className="text-slate-500">{u.nome}</span>
          <BotaoSair />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
