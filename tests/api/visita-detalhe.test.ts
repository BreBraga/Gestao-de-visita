import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const buscarVisita = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/visita/repositorio', () => ({ buscarVisita, db: {} }))

const params = Promise.resolve({ id: 'v1' })

describe('GET /api/visitas/[id]', () => {
  beforeEach(() => {
    exigirUsuario.mockReset()
    exigirUsuario.mockResolvedValue({ id: 'u1', papel: 'vendedor', zapleUserId: 'agente-1' })
    buscarVisita.mockReset()
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u1', titulo: 'AUTOCAR' })
  })

  it('devolve a visita do próprio vendedor', async () => {
    const { GET } = await import('@/app/api/visitas/[id]/route')

    const r = await GET(new Request('http://local'), { params })

    expect(r.status).toBe(200)
  })

  it('404 quando a visita não existe', async () => {
    buscarVisita.mockResolvedValue(null)
    const { GET } = await import('@/app/api/visitas/[id]/route')

    const r = await GET(new Request('http://local'), { params })

    expect(r.status).toBe(404)
  })

  it('403 na visita de outro vendedor', async () => {
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u2' })
    const { GET } = await import('@/app/api/visitas/[id]/route')

    const r = await GET(new Request('http://local'), { params })

    expect(r.status).toBe(403)
  })

  it('gestor enxerga visita de qualquer um', async () => {
    exigirUsuario.mockResolvedValue({ id: 'g1', papel: 'gestor', zapleUserId: 'agente-9' })
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u2' })
    const { GET } = await import('@/app/api/visitas/[id]/route')

    const r = await GET(new Request('http://local'), { params })

    expect(r.status).toBe(200)
  })
})
