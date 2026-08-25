import { redirect } from 'next/navigation'
import { buscarPorId } from './repositorio'
import { lerSessao } from './sessao'
import type { Usuario } from '@/lib/db'

/**
 * Revalida `ativo` a cada requisição. É o que permite desligar alguém na hora
 * sem manter uma tabela de sessões.
 */
export async function usuarioAtual(): Promise<Usuario | null> {
  const id = await lerSessao()
  if (!id) return null
  const u = await buscarPorId(id)
  return u?.ativo ? u : null
}

export async function exigirUsuario(): Promise<Usuario> {
  const u = await usuarioAtual()
  if (!u) redirect('/login')
  return u
}

export async function exigirGestor(): Promise<Usuario> {
  const u = await exigirUsuario()
  if (u.papel !== 'gestor') redirect('/agenda')
  return u
}
