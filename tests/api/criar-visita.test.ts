import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const criarVisitaRepo = vi.fn()
const buscarVisita = vi.fn()
const sincronizar = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/visita/repositorio', () => ({
  criarVisita: criarVisitaRepo,
  listarDoDia: vi.fn(),
  buscarVisita,
  db: {},
}))
vi.mock('@/lib/visita/sincronizador', () => ({ sincronizar }))

const CONTATO = 'c9b9a216-9707-4c45-acca-15fec0486051'
const USUARIO_OUTRO = '7a3e1f92-5c84-4b17-9d2a-6e0f8c4b1d35'
const AGENTE_OUTRO = '79e78c4b-3261-4b82-9010-a471cc005787'

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
    exigirUsuario.mockResolvedValue({
      id: 'u1',
      papel: 'vendedor',
      zapleUserId: 'agente-1',
    })
    criarVisitaRepo.mockReset()
    criarVisitaRepo.mockResolvedValue({ id: 'v1', titulo: 'AUTOCAR' })
    buscarVisita.mockReset()
    buscarVisita.mockResolvedValue({ id: 'v1', titulo: 'AUTOCAR' })
    sincronizar.mockReset()
    sincronizar.mockResolvedValue({ ok: true })
  })

  it('grava a visita e responde 201', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    const r = await POST(
      pedido({ titulo: 'AUTOCAR', contatoId: CONTATO, contatoNome: 'AUTOCAR', data: '2026-08-25' })
    )

    expect(r.status).toBe(201)
    expect(criarVisitaRepo).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ titulo: 'AUTOCAR', usuarioId: 'u1', zapleUserId: 'agente-1' })
    )
  })

  it('RESPONDE 201 MESMO QUANDO O ZAPLE FALHA — o bug que originou a fatia', async () => {
    sincronizar.mockResolvedValue({ ok: false, erro: 'O responsável não foi encontrado.' })
    const { POST } = await import('@/app/api/visitas/route')

    const r = await POST(
      pedido({ titulo: 'AUTOCAR', contatoId: CONTATO, contatoNome: 'AUTOCAR', data: '2026-08-25' })
    )

    expect(r.status).toBe(201)
  })

  it('recusa visita sem cliente', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    const r = await POST(pedido({ titulo: 'Sem cliente', data: '2026-08-25' }))

    expect(r.status).toBe(400)
    expect(criarVisitaRepo).not.toHaveBeenCalled()
  })

  it('recusa data em formato errado', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    const r = await POST(
      pedido({ titulo: 'X', contatoId: CONTATO, contatoNome: 'X', data: '25/08/2026' })
    )

    expect(r.status).toBe(400)
  })

  it('gestor pode criar visita para outro vendedor', async () => {
    exigirUsuario.mockResolvedValue({ id: 'g1', papel: 'gestor', zapleUserId: 'agente-9' })
    const { POST } = await import('@/app/api/visitas/route')

    await POST(
      pedido({
        titulo: 'X',
        contatoId: CONTATO,
        contatoNome: 'X',
        data: '2026-08-25',
        usuarioId: USUARIO_OUTRO,
        zapleUserId: AGENTE_OUTRO,
      })
    )

    expect(criarVisitaRepo).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ usuarioId: USUARIO_OUTRO, zapleUserId: AGENTE_OUTRO })
    )
  })

  it('vendedor não consegue criar visita para outro', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    await POST(
      pedido({
        titulo: 'X',
        contatoId: CONTATO,
        contatoNome: 'X',
        data: '2026-08-25',
        usuarioId: USUARIO_OUTRO,
        zapleUserId: AGENTE_OUTRO,
      })
    )

    expect(criarVisitaRepo).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ usuarioId: 'u1', zapleUserId: 'agente-1' })
    )
  })

  it('recusa usuarioId sem zapleUserId (ou vice-versa) em vez de decidir sozinho', async () => {
    exigirUsuario.mockResolvedValue({ id: 'g1', papel: 'gestor', zapleUserId: 'agente-9' })
    const { POST } = await import('@/app/api/visitas/route')

    const r = await POST(
      pedido({
        titulo: 'X',
        contatoId: CONTATO,
        contatoNome: 'X',
        data: '2026-08-25',
        usuarioId: USUARIO_OUTRO,
        // zapleUserId ausente de propósito
      })
    )

    expect(r.status).toBe(400)
    expect(criarVisitaRepo).not.toHaveBeenCalled()
  })
})
