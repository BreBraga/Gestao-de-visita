import { exigirUsuario } from '@/lib/auth/atual'
import { BotaoSair } from '@/components/BotaoSair'
import { BarraInferior } from '@/components/BarraInferior'

export const dynamic = 'force-dynamic'

export default async function LayoutApp({ children }: LayoutProps<'/'>) {
  const u = await exigirUsuario()
  const primeiroNome = u.nome.split(' ')[0]

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-asfalto px-4 pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between py-3">
          <span className="font-display text-lg font-semibold uppercase tracking-[0.14em]">
            Visitas
          </span>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-white/70">{primeiroNome}</span>
            <BotaoSair />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">{children}</main>

      <BarraInferior ehGestor={u.papel === 'gestor'} />
    </div>
  )
}
