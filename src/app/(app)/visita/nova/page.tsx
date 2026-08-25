import Link from 'next/link'
import { exigirUsuario } from '@/lib/auth/atual'
import { listarAgentes } from '@/lib/zaple/agentes'
import { FormNovaVisita } from './FormNovaVisita'

export const dynamic = 'force-dynamic'

export default async function NovaVisita() {
  const u = await exigirUsuario()

  // Só o gestor escolhe o responsável — para o vendedor a visita é sempre
  // dele, e um seletor de uma opção só seria ruído na tela do celular.
  const agentes = u.papel === 'gestor' ? await listarAgentes() : []

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-4">
      <Link href="/kanban" className="text-sm text-slate-600">
        ← Voltar
      </Link>
      <h1 className="text-xl font-semibold">Nova visita</h1>
      <FormNovaVisita
        agentes={agentes}
        // Gestor que não é atendente no Zaple — o caso de quem administra o
        // sistema sem atender cliente — não pode ficar como responsável: o
        // Zaple recusa o card. Para ele, escolher outra pessoa é obrigatório.
        souAgente={agentes.some((a) => a.userId === u.zapleUserId)}
      />
    </div>
  )
}
