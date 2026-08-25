import Link from 'next/link'
import { exigirUsuario } from '@/lib/auth/atual'
import { FormNovaVisita } from './FormNovaVisita'

export const dynamic = 'force-dynamic'

export default async function NovaVisita() {
  await exigirUsuario()

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-4">
      <Link href="/kanban" className="text-sm text-slate-600">
        ← Voltar
      </Link>
      <h1 className="text-xl font-semibold">Nova visita</h1>
      <FormNovaVisita />
    </div>
  )
}
