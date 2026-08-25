import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// vi.hoisted (não só const + vi.mock) porque este arquivo, ao contrário dos
// outros testes de rota, importa `sincronizar` estaticamente no topo — e
// import estático é hoisted pelo próprio ESM para antes de qualquer const,
// então os mocks precisam ser inicializados nesse mesmo ponto ou a primeira
// leitura de `criarCardZaple` etc. explode em "before initialization".
const { criarCardZaple, moverEtapa, listarEtapas, gravarNota } = vi.hoisted(() => ({
  criarCardZaple: vi.fn(),
  moverEtapa: vi.fn(),
  listarEtapas: vi.fn(),
  gravarNota: vi.fn(),
}))

vi.mock('@/lib/zaple/visitas', () => ({
  criarVisita: criarCardZaple,
  moverEtapa,
  listarVisitas: vi.fn(),
  obterVisita: vi.fn(),
  gravarNota,
}))
vi.mock('@/lib/zaple/painel', () => ({ listarEtapas, painelId: () => 'p1' }))

import { criarBancoDeTeste, criarUsuarioDeTeste } from '../apoio/banco'
import { criarVisita, buscarVisita, mudarStatus } from '@/lib/visita/repositorio'
import { sincronizar } from '@/lib/visita/sincronizador'
import { ZapleError } from '@/lib/zaple/erros'

const ETAPAS = [
  { id: 'e1', titulo: 'A fazer', posicao: 1, inicial: true, final: false },
  { id: 'e2', titulo: 'Realizada', posicao: 2, inicial: false, final: false },
]

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>
let usuarioId: string
let zapleUserId: string

beforeEach(async () => {
  banco = await criarBancoDeTeste()
  const u = await criarUsuarioDeTeste(banco.db)
  usuarioId = u.id
  zapleUserId = u.zapleUserId

  criarCardZaple.mockReset()
  criarCardZaple.mockResolvedValue({ id: '44444444-4444-4444-4444-444444444444' })
  moverEtapa.mockReset()
  moverEtapa.mockResolvedValue({})
  gravarNota.mockReset()
  gravarNota.mockResolvedValue({})
  listarEtapas.mockReset()
  listarEtapas.mockResolvedValue(ETAPAS)
})

afterEach(async () => {
  await banco.fechar()
})

function nova() {
  return {
    contatoId: '22222222-2222-2222-2222-222222222222',
    contatoNome: 'AUTOCAR',
    usuarioId,
    zapleUserId,
    data: '2026-08-25',
    titulo: 'AUTOCAR',
  }
}

describe('sincronizar', () => {
  it('cria o card no Zaple e marca a visita como sincronizada', async () => {
    const v = await criarVisita(banco.db, nova())

    const r = await sincronizar(banco.db, v)

    expect(r.ok).toBe(true)
    expect(criarCardZaple).toHaveBeenCalledWith(
      expect.objectContaining({ responsavelId: zapleUserId, contatoIds: [v.contatoId] })
    )
    const depois = await buscarVisita(banco.db, v.id)
    expect(depois?.cardId).toBe('44444444-4444-4444-4444-444444444444')
    expect(depois?.sincronizadoEm).not.toBeNull()
  })

  it('NÃO LANÇA quando o Zaple recusa — é a razão de existir desta fatia', async () => {
    criarCardZaple.mockRejectedValue(
      new ZapleError('FORM_ERROR', 500, 'O responsável informado não foi encontrado.')
    )
    const v = await criarVisita(banco.db, nova())

    const r = await sincronizar(banco.db, v)

    expect(r.ok).toBe(false)
    expect(r.erro).toContain('responsável')
  })

  it('a visita continua existindo depois da falha, e volta para a fila', async () => {
    criarCardZaple.mockRejectedValue(new ZapleError('FORM_ERROR', 500, 'qualquer erro'))
    const v = await criarVisita(banco.db, nova())

    await sincronizar(banco.db, v)

    const depois = await buscarVisita(banco.db, v.id)
    expect(depois).not.toBeNull()
    expect(depois?.sincronizadoEm).toBeNull()
  })

  it('não cria card de novo quando já existe — só move e anota', async () => {
    const v = await criarVisita(banco.db, nova())
    await sincronizar(banco.db, v)
    criarCardZaple.mockClear()

    const realizada = await mudarStatus(banco.db, v.id, 'realizada', 'Fechou negócio')
    await sincronizar(banco.db, realizada!)

    expect(criarCardZaple).not.toHaveBeenCalled()
    expect(moverEtapa).toHaveBeenCalledWith('44444444-4444-4444-4444-444444444444', 'e2')
    expect(gravarNota).toHaveBeenCalledWith(
      '44444444-4444-4444-4444-444444444444',
      expect.stringContaining('Fechou negócio')
    )
  })

  it('não trava quando a etapa não existe no painel — segue sem mover', async () => {
    listarEtapas.mockResolvedValue([ETAPAS[0]]) // sem "Realizada"
    const v = await criarVisita(banco.db, nova())
    await sincronizar(banco.db, v)
    const realizada = await mudarStatus(banco.db, v.id, 'realizada')

    const r = await sincronizar(banco.db, realizada!)

    expect(r.ok).toBe(true)
    expect(moverEtapa).not.toHaveBeenCalled()
  })

  it('não lança nem quando o erro não é do Zaple', async () => {
    criarCardZaple.mockRejectedValue(new Error('rede caiu'))
    const v = await criarVisita(banco.db, nova())

    const r = await sincronizar(banco.db, v)

    expect(r.ok).toBe(false)
  })
})
