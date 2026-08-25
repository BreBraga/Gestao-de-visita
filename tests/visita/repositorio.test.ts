import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { criarBancoDeTeste, criarUsuarioDeTeste } from '../apoio/banco'
import {
  criarVisita,
  buscarVisita,
  listarDoDia,
  mudarStatus,
  reagendar,
  listarNaoSincronizadas,
  marcarSincronizada,
} from '@/lib/visita/repositorio'
import { criarUsuarioDeTeste as criarOutroUsuario } from '../apoio/banco'

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

function entrada(sobrescreve: Partial<Parameters<typeof criarVisita>[1]> = {}) {
  return {
    contatoId: CONTATO,
    contatoNome: 'AUTOCAR',
    usuarioId,
    zapleUserId,
    data: '2026-08-25',
    titulo: 'AUTOCAR',
    ...sobrescreve,
  }
}

describe('criarVisita', () => {
  it('nasce a fazer, sem card e sem sincronismo', async () => {
    const v = await criarVisita(banco.db, entrada())

    expect(v.status).toBe('a_fazer')
    expect(v.cardId).toBeNull()
    expect(v.sincronizadoEm).toBeNull()
    expect(v.contatoNome).toBe('AUTOCAR')
  })

  it('guarda a data como string, sem deixar o fuso mover o dia', async () => {
    const v = await criarVisita(banco.db, entrada({ data: '2026-01-01' }))

    expect(v.data).toBe('2026-01-01')
  })

  it('aceita o tipo recorrente', async () => {
    const v = await criarVisita(banco.db, entrada({ tipo: 'recorrente' }))

    expect(v.tipo).toBe('recorrente')
  })
})

describe('buscarVisita', () => {
  it('devolve a visita pelo id', async () => {
    const criada = await criarVisita(banco.db, entrada())

    const achada = await buscarVisita(banco.db, criada.id)

    expect(achada?.id).toBe(criada.id)
  })

  it('devolve null quando não existe, em vez de estourar', async () => {
    const achada = await buscarVisita(banco.db, '33333333-3333-3333-3333-333333333333')

    expect(achada).toBeNull()
  })
})

describe('listarDoDia', () => {
  it('traz só as visitas do dia pedido', async () => {
    await criarVisita(banco.db, entrada({ data: '2026-08-25', titulo: 'DE HOJE' }))
    await criarVisita(banco.db, entrada({ data: '2026-08-26', titulo: 'DE AMANHÃ' }))

    const doDia = await listarDoDia(banco.db, { data: '2026-08-25' })

    expect(doDia).toHaveLength(1)
    expect(doDia[0].titulo).toBe('DE HOJE')
  })

  it('filtra por vendedor quando o usuarioId é passado', async () => {
    const outro = await criarOutroUsuario(banco.db, '99999999-9999-9999-9999-999999999999')
    await criarVisita(banco.db, entrada({ titulo: 'MINHA' }))
    await criarVisita(
      banco.db,
      entrada({ titulo: 'DO OUTRO', usuarioId: outro.id, zapleUserId: outro.zapleUserId })
    )

    const minhas = await listarDoDia(banco.db, { data: '2026-08-25', usuarioId })

    expect(minhas).toHaveLength(1)
    expect(minhas[0].titulo).toBe('MINHA')
  })

  it('sem usuarioId traz todos — é o "ver todos" do gestor', async () => {
    const outro = await criarOutroUsuario(banco.db, '99999999-9999-9999-9999-999999999999')
    await criarVisita(banco.db, entrada({ titulo: 'MINHA' }))
    await criarVisita(
      banco.db,
      entrada({ titulo: 'DO OUTRO', usuarioId: outro.id, zapleUserId: outro.zapleUserId })
    )

    const todas = await listarDoDia(banco.db, { data: '2026-08-25' })

    expect(todas).toHaveLength(2)
  })

  it('ordena por criação, para a lista não dançar a cada refresh', async () => {
    await criarVisita(banco.db, entrada({ titulo: 'PRIMEIRA' }))
    await criarVisita(banco.db, entrada({ titulo: 'SEGUNDA' }))

    const doDia = await listarDoDia(banco.db, { data: '2026-08-25' })

    expect(doDia.map((v) => v.titulo)).toEqual(['PRIMEIRA', 'SEGUNDA'])
  })
})

describe('mudarStatus', () => {
  it('marca realizada e guarda o relatório', async () => {
    const v = await criarVisita(banco.db, entrada())

    const alterada = await mudarStatus(banco.db, v.id, 'realizada', 'Cliente fechou 3 carros')

    expect(alterada?.status).toBe('realizada')
    expect(alterada?.relatorio).toBe('Cliente fechou 3 carros')
  })

  it('marca cancelada sem exigir relatório', async () => {
    const v = await criarVisita(banco.db, entrada())

    const alterada = await mudarStatus(banco.db, v.id, 'cancelada')

    expect(alterada?.status).toBe('cancelada')
    expect(alterada?.relatorio).toBeNull()
  })

  it('mexe em atualizada_em, para o sincronizador saber que mudou', async () => {
    const v = await criarVisita(banco.db, entrada())

    const alterada = await mudarStatus(banco.db, v.id, 'realizada')

    expect(alterada!.atualizadaEm.getTime()).toBeGreaterThanOrEqual(v.atualizadaEm.getTime())
  })

  it('devolve null para id que não existe', async () => {
    const alterada = await mudarStatus(
      banco.db,
      '33333333-3333-3333-3333-333333333333',
      'realizada'
    )

    expect(alterada).toBeNull()
  })

  it('preserva o relatório existente quando não recebe um novo', async () => {
    const v = await criarVisita(banco.db, entrada())
    await mudarStatus(banco.db, v.id, 'realizada', 'Cliente fechou 3 carros')

    const depois = await mudarStatus(banco.db, v.id, 'cancelada')

    // `undefined` preserva o que já estava lá; só `null` apagaria.
    expect(depois?.relatorio).toBe('Cliente fechou 3 carros')
  })

  it('apaga o relatório quando recebe null explícito', async () => {
    const v = await criarVisita(banco.db, entrada())
    await mudarStatus(banco.db, v.id, 'realizada', 'texto qualquer')

    const depois = await mudarStatus(banco.db, v.id, 'cancelada', null)

    expect(depois?.relatorio).toBeNull()
  })
})

describe('reagendar', () => {
  it('fecha a original como reagendada e cria uma nova a fazer', async () => {
    const v = await criarVisita(banco.db, entrada({ data: '2026-08-25' }))

    const r = await reagendar(banco.db, v.id, '2026-08-28')

    expect(r?.fechada.status).toBe('reagendada')
    expect(r?.fechada.data).toBe('2026-08-25')
    expect(r?.nova.status).toBe('a_fazer')
    expect(r?.nova.data).toBe('2026-08-28')
  })

  it('liga a nova à original, para o histórico não se perder', async () => {
    const v = await criarVisita(banco.db, entrada())

    const r = await reagendar(banco.db, v.id, '2026-08-28')

    expect(r?.nova.origemId).toBe(v.id)
  })

  it('leva cliente, vendedor, título e tipo para a visita nova', async () => {
    const v = await criarVisita(banco.db, entrada({ tipo: 'recorrente', titulo: 'AUTOCAR' }))

    const r = await reagendar(banco.db, v.id, '2026-08-28')

    expect(r?.nova.contatoId).toBe(v.contatoId)
    expect(r?.nova.contatoNome).toBe(v.contatoNome)
    expect(r?.nova.usuarioId).toBe(v.usuarioId)
    expect(r?.nova.tipo).toBe('recorrente')
    expect(r?.nova.titulo).toBe('AUTOCAR')
  })

  it('a visita reagendada some da agenda do dia original', async () => {
    const v = await criarVisita(banco.db, entrada({ data: '2026-08-25' }))
    await reagendar(banco.db, v.id, '2026-08-28')

    const doDia = await listarDoDia(banco.db, { data: '2026-08-25' })

    // Continua na tabela para o dashboard contar, mas com status reagendada.
    expect(doDia).toHaveLength(1)
    expect(doDia[0].status).toBe('reagendada')
  })

  it('devolve null para id que não existe', async () => {
    const r = await reagendar(banco.db, '33333333-3333-3333-3333-333333333333', '2026-08-28')

    expect(r).toBeNull()
  })

  it('devolve as duas visitas para a fila de sincronismo', async () => {
    const v = await criarVisita(banco.db, entrada())
    await marcarSincronizada(banco.db, v.id, '44444444-4444-4444-4444-444444444444')

    await reagendar(banco.db, v.id, '2026-08-28')

    // A original mudou de status e a nova nem existia: as duas precisam ir ao Zaple.
    expect(await listarNaoSincronizadas(banco.db)).toHaveLength(2)
  })
})

describe('fila de sincronismo', () => {
  it('a visita recém-criada está na fila', async () => {
    await criarVisita(banco.db, entrada())

    const fila = await listarNaoSincronizadas(banco.db)

    expect(fila).toHaveLength(1)
  })

  it('sai da fila ao ser marcada, guardando o card', async () => {
    const v = await criarVisita(banco.db, entrada())
    const CARD = '44444444-4444-4444-4444-444444444444'

    await marcarSincronizada(banco.db, v.id, CARD)

    expect(await listarNaoSincronizadas(banco.db)).toHaveLength(0)
    const depois = await buscarVisita(banco.db, v.id)
    expect(depois?.cardId).toBe(CARD)
    expect(depois?.sincronizadoEm).not.toBeNull()
  })

  it('volta para a fila quando o status muda, porque a cópia envelheceu', async () => {
    const v = await criarVisita(banco.db, entrada())
    await marcarSincronizada(banco.db, v.id, '44444444-4444-4444-4444-444444444444')

    await mudarStatus(banco.db, v.id, 'realizada')

    expect(await listarNaoSincronizadas(banco.db)).toHaveLength(1)
  })

  it('mantém o card_id ao voltar para a fila — o espelho é o mesmo', async () => {
    const v = await criarVisita(banco.db, entrada())
    const CARD = '44444444-4444-4444-4444-444444444444'
    await marcarSincronizada(banco.db, v.id, CARD)
    await mudarStatus(banco.db, v.id, 'realizada')

    const depois = await buscarVisita(banco.db, v.id)

    expect(depois?.cardId).toBe(CARD)
  })
})
