import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const buscarVisita = vi.fn()
const mudarStatus = vi.fn()
const reabrirVisita = vi.fn()
const realizarComRetorno = vi.fn()
const sincronizar = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/visita/repositorio', () => ({
  buscarVisita,
  mudarStatus,
  reabrirVisita,
  realizarComRetorno,
  db: {},
}))
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
    mudarStatus.mockResolvedValue({ id: 'v1', status: 'cancelada' })
    reabrirVisita.mockReset()
    reabrirVisita.mockResolvedValue({ id: 'v1', status: 'a_fazer' })
    realizarComRetorno.mockReset()
    realizarComRetorno.mockResolvedValue({
      realizada: { id: 'v1', status: 'realizada' },
      proxima: null,
    })
    sincronizar.mockReset()
    sincronizar.mockResolvedValue({ ok: true })
  })

  it('marca a própria visita como realizada, com o relato', async () => {
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    const r = await POST(
      pedido({ status: 'realizada', relatorio: 'Cliente fechou 3 filtros' }),
      { params }
    )

    expect(r.status).toBe(200)
    expect(realizarComRetorno).toHaveBeenCalledWith(
      expect.anything(),
      'v1',
      'Cliente fechou 3 filtros',
      undefined
    )
  })

  // O relato é o que vira histórico do cliente: sem ele, a visita realizada é
  // uma linha no relatório que não ajuda ninguém a decidir nada depois.
  it('RECUSA realizar sem o relato do que foi tratado', async () => {
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    const r = await POST(pedido({ status: 'realizada' }), { params })

    expect(r.status).toBe(400)
    expect(realizarComRetorno).not.toHaveBeenCalled()
  })

  it('recusa relato em branco, não só ausente', async () => {
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    const r = await POST(pedido({ status: 'realizada', relatorio: '   ' }), { params })

    expect(r.status).toBe(400)
    expect(realizarComRetorno).not.toHaveBeenCalled()
  })

  it('agenda o retorno junto, quando informado', async () => {
    realizarComRetorno.mockResolvedValue({
      realizada: { id: 'v1', status: 'realizada' },
      proxima: { id: 'v2', data: '2026-09-24' },
    })
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    const r = await POST(
      pedido({
        status: 'realizada',
        relatorio: 'Levar amostra no retorno',
        proximaVisita: { data: '2026-09-24', descricao: 'Fechar contrato mensal' },
      }),
      { params }
    )

    expect(r.status).toBe(200)
    expect(realizarComRetorno).toHaveBeenCalledWith(expect.anything(), 'v1', 'Levar amostra no retorno', {
      data: '2026-09-24',
      descricao: 'Fechar contrato mensal',
    })
    // As duas precisam ir ao Zaple: a fechada e a que nasceu.
    expect(sincronizar).toHaveBeenCalledTimes(2)
  })

  it('cancela sem exigir relato', async () => {
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    const r = await POST(pedido({ status: 'cancelada' }), { params })

    expect(r.status).toBe(200)
    expect(mudarStatus).toHaveBeenCalledWith(expect.anything(), 'v1', 'cancelada')
  })

  it('reabre visita fechada por engano', async () => {
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u1', status: 'realizada' })
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    const r = await POST(pedido({ status: 'a_fazer' }), { params })

    expect(r.status).toBe(200)
    expect(reabrirVisita).toHaveBeenCalledWith(expect.anything(), 'v1')
  })

  // A substituta já existe: reabrir as duas deixaria o mesmo cliente agendado
  // em dois dias diferentes, sem ninguém perceber.
  it('recusa reabrir visita que foi reagendada', async () => {
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u1', status: 'reagendada' })
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    const r = await POST(pedido({ status: 'a_fazer' }), { params })

    expect(r.status).toBe(409)
    expect(reabrirVisita).not.toHaveBeenCalled()
  })

  it('RECUSA marcar a visita de outro vendedor', async () => {
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u2', status: 'a_fazer' })
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    const r = await POST(pedido({ status: 'realizada', relatorio: 'x' }), { params })

    expect(r.status).toBe(403)
    expect(realizarComRetorno).not.toHaveBeenCalled()
  })

  it('gestor pode marcar visita de qualquer um', async () => {
    exigirUsuario.mockResolvedValue({ id: 'g1', papel: 'gestor', zapleUserId: 'agente-9' })
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u2', status: 'a_fazer' })
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    expect((await POST(pedido({ status: 'cancelada' }), { params })).status).toBe(200)
  })

  it('404 quando a visita não existe', async () => {
    buscarVisita.mockResolvedValue(null)
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    expect((await POST(pedido({ status: 'cancelada' }), { params })).status).toBe(404)
  })

  it('recusa status que não é destino válido', async () => {
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    expect((await POST(pedido({ status: 'reagendada' }), { params })).status).toBe(400)
    expect(mudarStatus).not.toHaveBeenCalled()
  })

  it('recusa fechar visita já fechada', async () => {
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u1', status: 'realizada' })
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    const r = await POST(pedido({ status: 'cancelada' }), { params })

    expect(r.status).toBe(409)
    expect(mudarStatus).not.toHaveBeenCalled()
  })

  it('não falha se o Zaple recusar — a visita já está gravada', async () => {
    sincronizar.mockResolvedValue({ ok: false, erro: 'Zaple fora do ar' })
    const { POST } = await import('@/app/api/visitas/[id]/status/route')

    const r = await POST(pedido({ status: 'realizada', relatorio: 'ok' }), { params })

    expect(r.status).toBe(200)
    expect(sincronizar).toHaveBeenCalled()
  })
})
