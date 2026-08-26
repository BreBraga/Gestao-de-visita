import { and, asc, count, desc, eq, gte, isNull, lte, ne } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { db as bancoPadrao, usuario, visita, type Visita } from '@/lib/db'
import type * as schema from '@/lib/db/schema'
import type { ContagemTipo } from './painel-tipos'

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

export type TipoVisita = 'prospeccao' | 'manutencao' | 'pedido' | 'entrega' | 'outro' | 'recorrente'

export type EntradaVisita = {
  contatoId: string
  contatoNome: string
  usuarioId: string
  zapleUserId: string
  data: string
  titulo: string
  tipo?: TipoVisita
  descricao?: string | null
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
      descricao: entrada.descricao ?? null,
    })
    .returning()
  return criada
}

export async function buscarVisita(db: BancoVisita, id: string): Promise<Visita | null> {
  const [achada] = await db.select().from(visita).where(eq(visita.id, id)).limit(1)
  return achada ?? null
}

/** A visita com o nome de quem a leva — o gestor precisa saber de quem é. */
export type VisitaDoDia = Visita & { vendedor: string }

export async function listarDoDia(
  db: BancoVisita,
  opcoes: { data: string; usuarioId?: string }
): Promise<VisitaDoDia[]> {
  // Sem usuarioId a consulta não filtra por vendedor: é o "ver todos" do
  // gestor. Quem chama decide, porque só a rota conhece o papel de quem pediu.
  const filtros = [eq(visita.data, opcoes.data)]
  if (opcoes.usuarioId) filtros.push(eq(visita.usuarioId, opcoes.usuarioId))

  // O join traz o nome do vendedor junto: na tela "ver a equipe" o gestor
  // precisa saber de quem é cada visita, e uma consulta por linha para
  // descobrir isso seria lenta e desnecessária.
  const linhas = await db
    .select({ visita, vendedor: usuario.nome })
    .from(visita)
    .innerJoin(usuario, eq(usuario.id, visita.usuarioId))
    .where(and(...filtros))
    .orderBy(asc(visita.criadaEm))

  return linhas.map((l) => ({ ...l.visita, vendedor: l.vendedor }))
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
  //
  // As duas escritas são uma coisa só: se o INSERT falhasse depois do UPDATE,
  // a visita original ficaria `reagendada` sem substituta e sumiria da agenda
  // do vendedor — um cliente perdido sem ninguém perceber.
  return db.transaction(async (tx) => {
    const [fechada] = await tx
      .update(visita)
      .set({ status: 'reagendada', atualizadaEm: new Date(), sincronizadoEm: null })
      .where(eq(visita.id, id))
      .returning()

    const [nova] = await tx
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
  })
}

export async function listarNaoSincronizadas(db: BancoVisita): Promise<Visita[]> {
  return db
    .select()
    .from(visita)
    .where(isNull(visita.sincronizadoEm))
    .orderBy(asc(visita.criadaEm))
}

export async function marcarSincronizada(
  db: BancoVisita,
  id: string,
  cardId: string,
  relatorioNoZaple?: string | null
): Promise<void> {
  await db
    .update(visita)
    .set({
      cardId,
      sincronizadoEm: new Date(),
      ...(relatorioNoZaple !== undefined ? { relatorioNoZaple } : {}),
    })
    .where(eq(visita.id, id))
}

/**
 * Grava só o vínculo com o card, sem marcar sincronismo.
 *
 * Existe para o sincronizador não perder o card recém-criado se o passo
 * seguinte falhar: sem isto, cada tentativa criaria um card novo no Zaple e
 * o painel encheria de órfãos.
 */
export async function marcarCard(db: BancoVisita, id: string, cardId: string): Promise<void> {
  await db.update(visita).set({ cardId }).where(eq(visita.id, id))
}

export type LinhaPainel = {
  usuarioId: string
  vendedor: string
  aFazer: number
  realizadas: number
  canceladas: number
  reagendadas: number
}

/**
 * Os números do gestor, agregados no banco.
 *
 * Esta consulta é a razão prática de a visita ter saído do CRM: montá-la pela
 * API do Zaple seria paginação sobre paginação, lenta e frágil. Aqui é uma
 * query — e é o que torna o painel viável.
 */
export async function resumoPorVendedor(
  db: BancoVisita,
  de: string,
  ate: string
): Promise<LinhaPainel[]> {
  const linhas = await db
    .select({
      usuarioId: visita.usuarioId,
      vendedor: usuario.nome,
      status: visita.status,
      total: count(),
    })
    .from(visita)
    .innerJoin(usuario, eq(usuario.id, visita.usuarioId))
    // Só vendedores. O painel mede a força de vendas em campo: uma visita que
    // um gestor fez para acompanhar a equipe não é produtividade de vendedor,
    // e contá-la inflaria o número de quem administra o sistema.
    .where(and(gte(visita.data, de), lte(visita.data, ate), eq(usuario.papel, 'vendedor')))
    .groupBy(visita.usuarioId, usuario.nome, visita.status)

  const porVendedor = new Map<string, LinhaPainel>()
  for (const l of linhas) {
    const atual = porVendedor.get(l.usuarioId) ?? {
      usuarioId: l.usuarioId,
      vendedor: l.vendedor,
      aFazer: 0,
      realizadas: 0,
      canceladas: 0,
      reagendadas: 0,
    }
    if (l.status === 'a_fazer') atual.aFazer = l.total
    if (l.status === 'realizada') atual.realizadas = l.total
    if (l.status === 'cancelada') atual.canceladas = l.total
    if (l.status === 'reagendada') atual.reagendadas = l.total
    porVendedor.set(l.usuarioId, atual)
  }

  return [...porVendedor.values()].sort((a, b) => b.realizadas - a.realizadas)
}

/**
 * Traz a visita para a qual esta foi reagendada.
 *
 * Uma visita `reagendada` está fechada, e a substituta é a que continua viva.
 * Sem este caminho, quem abrisse a antiga ficaria num beco: vê que foi
 * empurrada, mas não tem como chegar até a que vale.
 */
export async function buscarSubstituta(db: BancoVisita, id: string): Promise<Visita | null> {
  const [achada] = await db.select().from(visita).where(eq(visita.origemId, id)).limit(1)
  return achada ?? null
}

/** Os campos que o vendedor pode corrigir depois de criar a visita. */
export type EdicaoVisita = {
  titulo?: string
  descricao?: string | null
  tipo?: TipoVisita
  data?: string
}

export async function editarVisita(
  db: BancoVisita,
  id: string,
  patch: EdicaoVisita
): Promise<Visita | null> {
  const valores: Record<string, unknown> = {}
  if (patch.titulo !== undefined) valores.titulo = patch.titulo
  if (patch.descricao !== undefined) valores.descricao = patch.descricao
  if (patch.tipo !== undefined) valores.tipo = patch.tipo
  if (patch.data !== undefined) valores.data = patch.data
  if (Object.keys(valores).length === 0) return buscarVisita(db, id)

  valores.atualizadaEm = new Date()
  // O card no Zaple ficou velho: título, data e motivo mudaram deste lado.
  valores.sincronizadoEm = null

  const [alterada] = await db.update(visita).set(valores).where(eq(visita.id, id)).returning()
  return alterada ?? null
}

/**
 * Devolve uma visita fechada para "a fazer".
 *
 * Marcar realizada é um toque só, e um toque errado acontece — no bolso, no
 * carro, na pressa. Sem reabrir, o erro viraria uma visita fantasma no
 * relatório e um cliente que ninguém visita porque o sistema jura que sim.
 */
export async function reabrirVisita(db: BancoVisita, id: string): Promise<Visita | null> {
  const [alterada] = await db
    .update(visita)
    .set({ status: 'a_fazer', atualizadaEm: new Date(), sincronizadoEm: null })
    .where(eq(visita.id, id))
    .returning()
  return alterada ?? null
}

/**
 * Fecha a visita como realizada e já agenda o retorno, numa operação só.
 *
 * As duas coisas andam juntas porque acontecem juntas: o vendedor sai do
 * cliente sabendo o que foi tratado e quando volta. Separar em duas telas
 * garantiria que a segunda não fosse preenchida.
 */
export async function realizarComRetorno(
  db: BancoVisita,
  id: string,
  relatorio: string,
  retorno?: { data: string; descricao?: string | null }
): Promise<{ realizada: Visita; proxima: Visita | null } | null> {
  const original = await buscarVisita(db, id)
  if (!original) return null

  return db.transaction(async (tx) => {
    const [realizada] = await tx
      .update(visita)
      .set({ status: 'realizada', relatorio, atualizadaEm: new Date(), sincronizadoEm: null })
      .where(eq(visita.id, id))
      .returning()

    if (!retorno) return { realizada, proxima: null }

    const [proxima] = await tx
      .insert(visita)
      .values({
        contatoId: original.contatoId,
        contatoNome: original.contatoNome,
        usuarioId: original.usuarioId,
        zapleUserId: original.zapleUserId,
        data: retorno.data,
        titulo: original.titulo,
        tipo: 'manutencao',
        descricao: retorno.descricao ?? null,
        origemId: original.id,
      })
      .returning()

    return { realizada, proxima }
  })
}

/**
 * As outras visitas ao mesmo cliente, da mais nova para a mais antiga.
 *
 * É o que responde "o que já foi conversado aqui?" antes de o vendedor bater
 * na porta. Sem isso ele chega sem saber o que o colega prometeu no mês
 * passado — ou o que ele mesmo prometeu.
 */
export async function historicoDoContato(
  db: BancoVisita,
  contatoId: string,
  exceto: string
): Promise<Visita[]> {
  return db
    .select()
    .from(visita)
    .where(and(eq(visita.contatoId, contatoId), ne(visita.id, exceto)))
    .orderBy(desc(visita.data))
    .limit(20)
}

/**
 * Quantas visitas realizadas de cada tipo, por vendedor, no período.
 *
 * O recorte por `papel = 'vendedor'` acompanha `resumoPorVendedor`: assim as
 * duas seções do painel falam do mesmo conjunto de pessoas e não divergem.
 *
 * O índice `idx_visita_data_status` cobre o filtro de data e status.
 */
export async function contagemPorTipo(
  db: BancoVisita,
  de: string,
  ate: string
): Promise<ContagemTipo[]> {
  return db
    .select({
      tipo: visita.tipo,
      usuarioId: visita.usuarioId,
      total: count(),
    })
    .from(visita)
    .innerJoin(usuario, eq(usuario.id, visita.usuarioId))
    .where(
      and(
        eq(visita.status, 'realizada'),
        gte(visita.data, de),
        lte(visita.data, ate),
        eq(usuario.papel, 'vendedor')
      )
    )
    .groupBy(visita.tipo, visita.usuarioId)
}
