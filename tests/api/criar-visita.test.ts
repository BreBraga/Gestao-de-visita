import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ZapleError } from '@/lib/zaple/erros'

const exigirUsuario = vi.fn()
const criarVisita = vi.fn()
const listarEtapas = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/zaple/visitas', () => ({ criarVisita, listarVisitas: vi.fn() }))
vi.mock('@/lib/zaple/painel', () => ({ listarEtapas, painelId: () => 'p1' }))

const E1 = 'e5b1546c-f374-4d85-a8a2-25e424211c48'
const E2 = '8d008670-0b2a-4349-9375-716e62b0ef58'
const CONTATO = 'c9b9a216-9707-4c45-acca-15fec0486051'
const AGENTE_OUTRO = '79e78c4b-3261-4b82-9010-a471cc005787'

const ETAPAS = [
  { id: E1, titulo: 'Prospecção', posicao: 1, inicial: true, final: false },
  { id: E2, titulo: 'Visita', posicao: 2, inicial: false, final: false },
]

function pedido(corpo: unknown) {
  return new Request('http://local/api/visitas', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/visitas', () => {
  beforeEach(() => {
    exigirUsuario.mockReset()
    exigirUsuario.mockResolvedValue({ id: 'u1', papel: 'vendedor', zapleUserId: 'agente-1' })
    listarEtapas.mockReset()
    listarEtapas.mockResolvedValue(ETAPAS)
    criarVisita.mockReset()
    criarVisita.mockResolvedValue({ id: 'v1' })
  })

  it('cria na etapa inicial, com o próprio vendedor como responsável', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    const r = await POST(pedido({ titulo: 'Padaria do Zé', contatoId: CONTATO }))

    expect(r.status).toBe(201)
    expect(criarVisita).toHaveBeenCalledWith({
      etapaId: E1,
      titulo: 'Padaria do Zé',
      responsavelId: 'agente-1',
      contatoIds: [CONTATO],
      prazo: undefined,
    })
  })

  it('vendedor não consegue atribuir a visita a outra pessoa', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    await POST(pedido({ titulo: 'X', contatoId: CONTATO, responsavelId: AGENTE_OUTRO }))

    expect(criarVisita).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: 'agente-1' }))
  })

  it('gestor pode atribuir a visita a outro vendedor', async () => {
    exigirUsuario.mockResolvedValue({ id: 'g1', papel: 'gestor', zapleUserId: 'agente-9' })
    const { POST } = await import('@/app/api/visitas/route')

    await POST(pedido({ titulo: 'X', contatoId: CONTATO, responsavelId: AGENTE_OUTRO }))

    expect(criarVisita).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: AGENTE_OUTRO }))
  })

  it('recusa visita sem contato', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    const r = await POST(pedido({ titulo: 'Sem cliente' }))

    expect(r.status).toBe(400)
    expect(criarVisita).not.toHaveBeenCalled()
  })

  it('recusa título vazio', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    expect((await POST(pedido({ titulo: '', contatoId: CONTATO }))).status).toBe(400)
  })

  // Sem isto o ZapleError sobe até o Next, que responde 500 com corpo vazio.
  // No cliente, o `(await r.json()).erro` do formulário estoura no corpo vazio
  // e cai no catch de rede — a recusa do Zaple vira "Sem conexão" na tela.
  it('traduz recusa do Zaple em JSON com a mensagem real', async () => {
    criarVisita.mockRejectedValue(
      new ZapleError('FORM_ERROR', 500, 'O responsável informado não foi encontrado.')
    )
    const { POST } = await import('@/app/api/visitas/route')

    const r = await POST(pedido({ titulo: 'X', contatoId: CONTATO }))

    expect(r.status).toBe(404)
    expect(await r.json()).toEqual({ erro: 'O responsável informado não foi encontrado.' })
  })

  it('não engole erro que não é do Zaple', async () => {
    criarVisita.mockRejectedValue(new Error('bug de programação'))
    const { POST } = await import('@/app/api/visitas/route')

    await expect(POST(pedido({ titulo: 'X', contatoId: CONTATO }))).rejects.toThrow(
      'bug de programação'
    )
  })
})
