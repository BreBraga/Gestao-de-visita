import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const obterVisita = vi.fn()
const moverEtapa = vi.fn()
const listarEtapas = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/zaple/visitas', () => ({ obterVisita, moverEtapa }))
vi.mock('@/lib/zaple/painel', () => ({ listarEtapas, painelId: () => 'p1' }))

// stepIds reais do PAINEL DE VISITAS.
const E1 = 'e5b1546c-f374-4d85-a8a2-25e424211c48'
const E2 = '8d008670-0b2a-4349-9375-716e62b0ef58'

const ETAPAS = [
  { id: E1, titulo: 'Prospecção', posicao: 1, inicial: true, final: false },
  { id: E2, titulo: 'Visita', posicao: 2, inicial: false, final: false },
]

function pedido(corpo: unknown) {
  return new Request('http://local/api/visitas/v1/mover', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })
}

const contexto = { params: Promise.resolve({ id: 'v1' }) }

describe('POST /api/visitas/[id]/mover', () => {
  beforeEach(() => {
    exigirUsuario.mockReset()
    exigirUsuario.mockResolvedValue({ id: 'u1', papel: 'vendedor', zapleUserId: 'agente-1' })
    listarEtapas.mockReset()
    listarEtapas.mockResolvedValue(ETAPAS)
    obterVisita.mockReset()
    obterVisita.mockResolvedValue({ id: 'v1', etapaId: E1, etapaTitulo: 'Prospecção', responsavelId: 'agente-1' })
    moverEtapa.mockReset()
    moverEtapa.mockResolvedValue({ id: 'v1', etapaId: E2 })
  })

  it('move quando a etapa atual confere', async () => {
    const { POST } = await import('@/app/api/visitas/[id]/mover/route')

    const r = await POST(pedido({ etapaId: E2, etapaAtualId: E1 }), contexto)

    expect(r.status).toBe(200)
    expect(moverEtapa).toHaveBeenCalledWith('v1', E2)
  })

  it('responde 409 quando alguém já moveu o card no Zaple', async () => {
    // Sem esta verificação o app sobrescreveria o trabalho do colega calado.
    obterVisita.mockResolvedValue({ id: 'v1', etapaId: E2, etapaTitulo: 'Visita', responsavelId: 'agente-1' })
    const { POST } = await import('@/app/api/visitas/[id]/mover/route')

    const r = await POST(pedido({ etapaId: E1, etapaAtualId: E1 }), contexto)

    expect(r.status).toBe(409)
    expect((await r.json()).erro).toContain('Visita')
    expect(moverEtapa).not.toHaveBeenCalled()
  })

  it('recusa vendedor movendo visita de outro', async () => {
    obterVisita.mockResolvedValue({ id: 'v1', etapaId: E1, responsavelId: 'agente-outro' })
    const { POST } = await import('@/app/api/visitas/[id]/mover/route')

    const r = await POST(pedido({ etapaId: E2, etapaAtualId: E1 }), contexto)

    expect(r.status).toBe(403)
    expect(moverEtapa).not.toHaveBeenCalled()
  })

  it('deixa o gestor mover a visita de qualquer um', async () => {
    exigirUsuario.mockResolvedValue({ id: 'g1', papel: 'gestor', zapleUserId: 'agente-9' })
    obterVisita.mockResolvedValue({ id: 'v1', etapaId: E1, responsavelId: 'agente-outro' })
    const { POST } = await import('@/app/api/visitas/[id]/mover/route')

    const r = await POST(pedido({ etapaId: E2, etapaAtualId: E1 }), contexto)

    expect(r.status).toBe(200)
  })

  it('recusa etapa que não pertence ao painel', async () => {
    const { POST } = await import('@/app/api/visitas/[id]/mover/route')

    const r = await POST(
      pedido({ etapaId: 'e76733df-0a6d-441c-bb7b-7c0969f3bd89', etapaAtualId: E1 }),
      contexto
    )

    expect(r.status).toBe(400)
    expect(moverEtapa).not.toHaveBeenCalled()
  })
})
