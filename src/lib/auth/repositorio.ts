import { eq } from 'drizzle-orm'
import { db, usuario, type Usuario } from '@/lib/db'

export async function buscarPorTelefone(telefone: string): Promise<Usuario | null> {
  const [achado] = await db.select().from(usuario).where(eq(usuario.telefone, telefone)).limit(1)
  return achado ?? null
}

export async function buscarPorId(id: string): Promise<Usuario | null> {
  const [achado] = await db.select().from(usuario).where(eq(usuario.id, id)).limit(1)
  return achado ?? null
}
