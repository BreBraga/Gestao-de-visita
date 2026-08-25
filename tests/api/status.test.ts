import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const buscarVisita = vi.fn()
const mudarStatus = vi.fn()
const sincronizar = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/visita/repositorio', () => ({ buscarVisita, mudarStatus, db: {} }))
vi.mock('@/lib/visita/sincronizador', () => ({ sincronizar }))

const params = Promise.resolve({ id: 'v1' })

function pedido(corpo: unknown) {
  return new Request('http://local/api/visitas/v1/status', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/visitas/[id]/status', () => {
  beforeEach(() => {
    exigirUsuario.mockReset()
    exigirUsuario.mockResolvedValue({ id: 'u1', papel: 'vendedor', zapleUserId: 'agente-1' })
    buscarVisita.mockReset()
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u1', status: 'a_fazer' })
    mudarStatus.mockReset()
    mudarStatus.mockResolvedValue({ id: 'v1', status: 'realizada' })
    sincronizar.mockReset()
    sincronizar.mockResolvedValue({ ok: true })
  })

  it('marca a própria visita como realizada, com relatório', async () => {
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    const r = await POST(pedido({ status: 'realizada', relatorio: 'Fechou negócio' }), { params })

    expect(r.status).toBe(200)
    expect(mudarStatus).toHaveBeenCalledWith(expect.anything(), 'v1', 'realizada', 'Fechou negócio')
  })

  it('RECUSA marcar a visita de outro vendedor', async () => {
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u2' })
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    const r = await POST(pedido({ status: 'realizada' }), { params })

    expect(r.status).toBe(403)
    expect(mudarStatus).not.toHaveBeenCalled()
  })

  it('gestor pode marcar visita de qualquer um', async () => {
    exigirUsuario.mockResolvedValue({ id: 'g1', papel: 'gestor', zapleUserId: 'agente-9' })
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u2', status: 'a_fazer' })
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    expect((await POST(pedido({ status: 'cancelada' }), { params })).status).toBe(200)
  })

  it('recusa operar sobre visita já fechada', async () => {
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u1', status: 'realizada' })
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    const r = await POST(pedido({ status: 'cancelada' }), { params })

    expect(r.status).toBe(409)
    // A mutação NÃO pode ter acontecido.
    expect(mudarStatus).not.toHaveBeenCalled()
  })

  it('404 quando a visita não existe', async () => {
    buscarVisita.mockResolvedValue(null)
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    expect((await POST(pedido({ status: 'realizada' }), { params })).status).toBe(404)
  })

  it('recusa status que não seja realizada ou cancelada', async () => {
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    // 'reagendada' tem rota própria; 'a_fazer' não é um destino válido aqui.
    expect((await POST(pedido({ status: 'reagendada' }), { params })).status).toBe(400)
    expect(mudarStatus).not.toHaveBeenCalled()
  })

  it('sincroniza depois de gravar, e não falha se o Zaple recusar', async () => {
    sincronizar.mockResolvedValue({ ok: false, erro: 'Zaple fora do ar' })
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    const r = await POST(pedido({ status: 'realizada' }), { params })

    expect(r.status).toBe(200)
    expect(sincronizar).toHaveBeenCalled()
  })
})
