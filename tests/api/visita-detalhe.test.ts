import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const obterVisita = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/zaple/visitas', () => ({ obterVisita }))

const contexto = { params: Promise.resolve({ id: 'v1' }) }

describe('GET /api/visitas/[id]', () => {
  beforeEach(() => {
    exigirUsuario.mockReset()
    obterVisita.mockReset()
    obterVisita.mockResolvedValue({ id: 'v1', titulo: 'Padaria', responsavelId: 'agente-1' })
  })

  it('devolve a visita do próprio vendedor', async () => {
    exigirUsuario.mockResolvedValue({ papel: 'vendedor', zapleUserId: 'agente-1' })
    const { GET } = await import('@/app/api/visitas/[id]/route')

    const r = await GET(new Request('http://local'), contexto)

    expect(r.status).toBe(200)
    expect((await r.json()).visita.titulo).toBe('Padaria')
  })

  it('recusa a visita de outro vendedor', async () => {
    exigirUsuario.mockResolvedValue({ papel: 'vendedor', zapleUserId: 'agente-2' })
    const { GET } = await import('@/app/api/visitas/[id]/route')

    expect((await GET(new Request('http://local'), contexto)).status).toBe(403)
  })

  it('gestor vê qualquer visita', async () => {
    exigirUsuario.mockResolvedValue({ papel: 'gestor', zapleUserId: 'agente-9' })
    const { GET } = await import('@/app/api/visitas/[id]/route')

    expect((await GET(new Request('http://local'), contexto)).status).toBe(200)
  })
})
