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

export type PatchUsuario = {
  nome?: string
  telefone?: string
  email?: string | null
  zapleUserId?: string
  ativo?: boolean
  papel?: 'vendedor' | 'gestor'
  senha?: string
}

export async function alterarUsuario(id: string, patch: PatchUsuario): Promise<void> {
  const valores: Record<string, unknown> = {}
  if (patch.nome !== undefined) valores.nome = patch.nome
  // Normaliza igual à criação: o telefone é o identificador de login, e um
  // número gravado com máscara aqui deixaria a pessoa sem conseguir entrar.
  if (patch.telefone !== undefined) valores.telefone = normalizarTelefone(patch.telefone)
  if (patch.email !== undefined) valores.email = patch.email
  if (patch.zapleUserId !== undefined) valores.zapleUserId = patch.zapleUserId
  if (patch.ativo !== undefined) valores.ativo = patch.ativo
  if (patch.papel !== undefined) valores.papel = patch.papel
  if (patch.senha) valores.senhaHash = await gerarHash(patch.senha)
  if (Object.keys(valores).length === 0) return
  await db.update(usuario).set(valores).where(eq(usuario.id, id))
}
