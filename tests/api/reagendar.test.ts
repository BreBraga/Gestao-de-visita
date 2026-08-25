import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const buscarVisita = vi.fn()
const reagendarRepo = vi.fn()
const sincronizar = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/visita/repositorio', () => ({ buscarVisita, reagendar: reagendarRepo, db: {} }))
vi.mock('@/lib/visita/sincronizador', () => ({ sincronizar }))

const params = Promise.resolve({ id: 'v1' })

function pedido(corpo: unknown) {
  return new Request('http://local/api/visitas/v1/reagendar', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/visitas/[id]/reagendar', () => {
  beforeEach(() => {
    exigirUsuario.mockReset()
    exigirUsuario.mockResolvedValue({ id: 'u1', papel: 'vendedor', zapleUserId: 'agente-1' })
    buscarVisita.mockReset()
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u1' })
    reagendarRepo.mockReset()
    reagendarRepo.mockResolvedValue({ fechada: { id: 'v1' }, nova: { id: 'v2' } })
    sincronizar.mockReset()
    sincronizar.mockResolvedValue({ ok: true })
  })

  it('reagenda a própria visita', async () => {
    const { POST } = await import('@/app/api/visitas/[id]/reagendar/route')

    const r = await POST(pedido({ data: '2026-09-01' }), { params })

    expect(r.status).toBe(201)
    expect(reagendarRepo).toHaveBeenCalledWith(expect.anything(), 'v1', '2026-09-01')
  })

  it('RECUSA reagendar visita de outro vendedor', async () => {
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u2' })
    const { POST } = await import('@/app/api/visitas/[id]/reagendar/route')

    const r = await POST(pedido({ data: '2026-09-01' }), { params })

    expect(r.status).toBe(403)
    expect(reagendarRepo).not.toHaveBeenCalled()
  })

  it('gestor pode reagendar visita de qualquer um', async () => {
    exigirUsuario.mockResolvedValue({ id: 'g1', papel: 'gestor', zapleUserId: 'agente-9' })
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u2' })
    const { POST } = await import('@/app/api/visitas/[id]/reagendar/route')

    expect((await POST(pedido({ data: '2026-09-01' }), { params })).status).toBe(201)
  })

  it('404 quando a visita não existe', async () => {
    buscarVisita.mockResolvedValue(null)
    const { POST } = await import('@/app/api/visitas/[id]/reagendar/route')

    expect((await POST(pedido({ data: '2026-09-01' }), { params })).status).toBe(404)
  })

  it('recusa data que não seja AAAA-MM-DD', async () => {
    const { POST } = await import('@/app/api/visitas/[id]/reagendar/route')

    expect((await POST(pedido({ data: '01/09/2026' }), { params })).status).toBe(400)
    expect(reagendarRepo).not.toHaveBeenCalled()
  })

  it('sincroniza as duas visitas: a fechada e a nova', async () => {
    const { POST } = await import('@/app/api/visitas/[id]/reagendar/route')

    await POST(pedido({ data: '2026-09-01' }), { params })

    expect(sincronizar).toHaveBeenCalledTimes(2)
  })

  it('devolve a visita nova, não a fechada', async () => {
    const { POST } = await import('@/app/api/visitas/[id]/reagendar/route')

    const r = await POST(pedido({ data: '2026-09-01' }), { params })

    expect((await r.json()).visita.id).toBe('v2')
  })
})
