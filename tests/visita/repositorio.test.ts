import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { criarBancoDeTeste, criarUsuarioDeTeste } from '../apoio/banco'
import { criarVisita, buscarVisita } from '@/lib/visita/repositorio'

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
