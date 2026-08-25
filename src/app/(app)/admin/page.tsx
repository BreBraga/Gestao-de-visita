import { exigirGestor } from '@/lib/auth/atual'
import { listarUsuarios } from '@/lib/auth/usuarios'
import { listarAgentes } from '@/lib/zaple/agentes'
import { FormUsuario } from './FormUsuario'

export const dynamic = 'force-dynamic'

export default async function Admin() {
  await exigirGestor()
  const [usuarios, agentes] = await Promise.all([listarUsuarios(), listarAgentes()])

  // Indexado por userId, que é o que guardamos em usuario.zapleUserId.
  const nomeDoAgente = new Map(agentes.map((a) => [a.userId, a.nome]))

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">Vendedores</h1>
      <FormUsuario agentes={agentes} />

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {usuarios.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-500">Nenhum vendedor cadastrado ainda.</li>
        )}
        {usuarios.map((u) => (
          <li key={u.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{u.nome}</p>
              <p className="text-sm text-slate-500">
                {u.telefone} · {u.papel} · Zaple: {nomeDoAgente.get(u.zapleUserId) ?? 'agente removido'}
              </p>
            </div>
            <span className={u.ativo ? 'text-sm text-emerald-600' : 'text-sm text-slate-400'}>
              {u.ativo ? 'ativo' : 'inativo'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
