import { asc, eq } from 'drizzle-orm'
import { db, usuario, type Usuario } from '@/lib/db'
import { normalizarTelefone } from '@/lib/zaple/contatos'
import { gerarHash } from './senha'

export type NovaEntradaUsuario = {
  nome: string
  telefone: string
  email?: string | null
  senha: string
  zapleUserId: string
  papel: 'vendedor' | 'gestor'
}

export async function criarUsuario(entrada: NovaEntradaUsuario): Promise<Usuario> {
  const [criado] = await db
    .insert(usuario)
    .values({
      nome: entrada.nome,
      telefone: normalizarTelefone(entrada.telefone),
      email: entrada.email ?? null,
      senhaHash: await gerarHash(entrada.senha),
      zapleUserId: entrada.zapleUserId,
      papel: entrada.papel,
    })
    .returning()
  return criado
}

export function listarUsuarios(): Promise<Usuario[]> {
  return db.select().from(usuario).orderBy(asc(usuario.nome))
}

export async function alterarUsuario(
  id: string,
  patch: { ativo?: boolean; papel?: 'vendedor' | 'gestor'; senha?: string }
): Promise<void> {
  const valores: Record<string, unknown> = {}
  if (patch.ativo !== undefined) valores.ativo = patch.ativo
  if (patch.papel !== undefined) valores.papel = patch.papel
  if (patch.senha) valores.senhaHash = await gerarHash(patch.senha)
  if (Object.keys(valores).length === 0) return
  await db.update(usuario).set(valores).where(eq(usuario.id, id))
}
