import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { criarBancoDeTeste, criarUsuarioDeTeste } from '../apoio/banco'
import { criarVisita, contagemPorTipo } from '@/lib/visita/repositorio'
import { usuario, visita } from '@/lib/db/schema'

const CONTATO = '22222222-2222-2222-2222-222222222222'

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>
let usuarioId: string
let zapleUserId: string

beforeEach(async () => {
  banco = await criarBancoDeTeste()
  const u = await criarUsuarioDeTeste(banco.db)
  usuarioId = u.id
  zapleUserId = u.zapleUserId
})

afterEach(async () => {
  await banco.fechar()
})

/**
 * Cria a visita e a marca como realizada direto no banco.
 *
 * Vai pelo UPDATE e não por `mudarStatus` de propósito: `mudarStatus` exige
 * relatório e dispara o sincronismo com o Zaple, e este teste é sobre a
 * consulta, não sobre a regra de transição.
 */
async function visitaRealizada(
  tipo: string,
  data = '2026-08-20',
  dono: { usuarioId: string; zapleUserId: string } = { usuarioId, zapleUserId }
) {
  const v = await criarVisita(banco.db, {
    contatoId: CONTATO,
    contatoNome: 'AUTOCAR',
    usuarioId: dono.usuarioId,
    zapleUserId: dono.zapleUserId,
    data,
    titulo: 'AUTOCAR',
    tipo: tipo as never,
  })
  await banco.db.update(visita).set({ status: 'realizada' }).where(eq(visita.id, v.id))
  return v
}

describe('contagemPorTipo', () => {
  it('conta as visitas realizadas agrupadas por tipo', async () => {
    await visitaRealizada('prospeccao')
    await visitaRealizada('prospeccao')
    await visitaRealizada('pedido')

    const linhas = await contagemPorTipo(banco.db, '2026-08-01', '2026-08-31')

    const porTipo = Object.fromEntries(linhas.map((l) => [l.tipo, l.total]))
    expect(porTipo).toEqual({ prospeccao: 2, pedido: 1 })
  })

  it('devolve o usuarioId, para o recorte por vendedor', async () => {
    await visitaRealizada('pedido')

    const linhas = await contagemPorTipo(banco.db, '2026-08-01', '2026-08-31')

    expect(linhas[0].usuarioId).toBe(usuarioId)
  })

  it('ignora visitas que não foram realizadas', async () => {
    // criarVisita nasce com status 'a_fazer'.
    await criarVisita(banco.db, {
      contatoId: CONTATO,
      contatoNome: 'AUTOCAR',
      usuarioId,
      zapleUserId,
      data: '2026-08-20',
      titulo: 'AUTOCAR',
      tipo: 'prospeccao',
    })

    expect(await contagemPorTipo(banco.db, '2026-08-01', '2026-08-31')).toEqual([])
  })

  it('ignora visitas fora do período', async () => {
    await visitaRealizada('pedido', '2026-07-15')

    expect(await contagemPorTipo(banco.db, '2026-08-01', '2026-08-31')).toEqual([])
  })

  it('inclui os extremos do período', async () => {
    await visitaRealizada('pedido', '2026-08-01')
    await visitaRealizada('entrega', '2026-08-31')

    const linhas = await contagemPorTipo(banco.db, '2026-08-01', '2026-08-31')

    expect(linhas).toHaveLength(2)
  })

  it('ignora visitas de gestor, como o resumo por vendedor já faz', async () => {
    // Uma visita que um gestor fez para acompanhar a equipe não é
    // produtividade de vendedor, e contá-la infla quem administra o sistema.
    const gestor = await criarUsuarioDeTeste(banco.db, '33333333-3333-3333-3333-333333333333')
    await banco.db.update(usuario).set({ papel: 'gestor' }).where(eq(usuario.id, gestor.id))

    await visitaRealizada('pedido', '2026-08-20', {
      usuarioId: gestor.id,
      zapleUserId: gestor.zapleUserId,
    })

    expect(await contagemPorTipo(banco.db, '2026-08-01', '2026-08-31')).toEqual([])
  })
})
