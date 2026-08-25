import { redirect } from 'next/navigation'
import { usuarioAtual } from '@/lib/auth/atual'
import { FormLogin } from './FormLogin'

export const dynamic = 'force-dynamic'

export default async function Login() {
  if (await usuarioAtual()) redirect('/agenda')

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6">
      <h1 className="text-2xl font-semibold">Gestão de Visitas</h1>
      <FormLogin />
    </main>
  )
}
