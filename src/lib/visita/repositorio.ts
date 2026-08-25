import { and, asc, eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { db as bancoPadrao, visita, type Visita } from '@/lib/db'
import type * as schema from '@/lib/db/schema'

/**
 * A conexão entra por parâmetro para o teste injetar o Postgres em memória.
 * Em produção quem chama passa `bancoPadrao`, exportado aqui como `db`.
 *
 * O tipo é o `PgDatabase` genérico, e não `typeof bancoPadrao`, porque cada
 * driver do Drizzle carrega o próprio `QueryResultHKT`: o tipo da conexão de
 * produção (postgres-js) recusa a de teste (PGlite) em tempo de compilação,
 * mesmo com as duas sendo Drizzle válidas. O Vitest não type-checa, então o
 * teste passaria e só o `next build` quebraria — longe daqui.
 */
export type BancoVisita = PgDatabase<PgQueryResultHKT, typeof schema>

export { bancoPadrao as db }

export type EntradaVisita = {
  contatoId: string
  contatoNome: string
  usuarioId: string
  zapleUserId: string
  data: string
  titulo: string
  tipo?: 'prospeccao' | 'recorrente'
}

export async function criarVisita(db: BancoVisita, entrada: EntradaVisita): Promise<Visita> {
  const [criada] = await db
    .insert(visita)
    .values({
      contatoId: entrada.contatoId,
      contatoNome: entrada.contatoNome,
      usuarioId: entrada.usuarioId,
      zapleUserId: entrada.zapleUserId,
      data: entrada.data,
      titulo: entrada.titulo,
      tipo: entrada.tipo ?? 'prospeccao',
    })
    .returning()
  return criada
}

export async function buscarVisita(db: BancoVisita, id: string): Promise<Visita | null> {
  const [achada] = await db.select().from(visita).where(eq(visita.id, id)).limit(1)
  return achada ?? null
}

export async function listarDoDia(
  db: BancoVisita,
  opcoes: { data: string; usuarioId?: string }
): Promise<Visita[]> {
  // Sem usuarioId a consulta não filtra por vendedor: é o "ver todos" do
  // gestor. Quem chama decide, porque só a rota conhece o papel de quem pediu.
  const filtros = [eq(visita.data, opcoes.data)]
  if (opcoes.usuarioId) filtros.push(eq(visita.usuarioId, opcoes.usuarioId))

  return db
    .select()
    .from(visita)
    .where(and(...filtros))
    .orderBy(asc(visita.criadaEm))
}

export async function mudarStatus(
  db: BancoVisita,
  id: string,
  status: 'realizada' | 'cancelada',
  relatorio?: string | null
): Promise<Visita | null> {
  const [alterada] = await db
    .update(visita)
    .set({
      status,
      // `undefined` preserva o relatório que já existe; `null` apaga.
      ...(relatorio !== undefined ? { relatorio } : {}),
      atualizadaEm: new Date(),
      // A cópia no Zaple ficou velha. Nulo põe a visita de volta na fila.
      sincronizadoEm: null,
    })
    .where(eq(visita.id, id))
    .returning()
  return alterada ?? null
}

export async function reagendar(
  db: BancoVisita,
  id: string,
  novaData: string
): Promise<{ fechada: Visita; nova: Visita } | null> {
  const original = await buscarVisita(db, id)
  if (!original) return null

  // Duas linhas, não uma. Mudar a data na mesma linha geraria o número de
  // adiamentos, mas apagaria quando cada um aconteceu — e é justamente essa
  // data original que mostra se o vendedor está empurrando cliente com a
  // barriga.
  const [fechada] = await db
    .update(visita)
    .set({ status: 'reagendada', atualizadaEm: new Date(), sincronizadoEm: null })
    .where(eq(visita.id, id))
    .returning()

  const [nova] = await db
    .insert(visita)
    .values({
      contatoId: original.contatoId,
      contatoNome: original.contatoNome,
      usuarioId: original.usuarioId,
      zapleUserId: original.zapleUserId,
      data: novaData,
      titulo: original.titulo,
      tipo: original.tipo,
      origemId: original.id,
    })
    .returning()

  return { fechada, nova }
}
