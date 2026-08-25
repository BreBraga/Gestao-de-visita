import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const listarDoDia = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/visita/repositorio', () => ({
  listarDoDia,
  criarVisita: vi.fn(),
  db: {},
}))
vi.mock('@/lib/visita/sincronizador', () => ({ sincronizar: vi.fn() }))

function pedido(query = '') {
  return new Request(`http://local/api/visitas${query}`)
}

describe('GET /api/visitas', () => {
  beforeEach(() => {
    exigirUsuario.mockReset()
    exigirUsuario.mockResolvedValue({ id: 'u1', papel: 'vendedor', zapleUserId: 'agente-1' })
    listarDoDia.mockReset()
    listarDoDia.mockResolvedValue([])
  })

  it('filtra pelo próprio vendedor', async () => {
    const { GET } = await import('@/app/api/visitas/route')

    await GET(pedido('?data=2026-08-25'))

    expect(listarDoDia).toHaveBeenCalledWith(
      expect.anything(),
      { data: '2026-08-25', usuarioId: 'u1' }
    )
  })

  it('gestor com todos=1 vê a agenda inteira', async () => {
    exigirUsuario.mockResolvedValue({ id: 'g1', papel: 'gestor', zapleUserId: 'agente-9' })
    const { GET } = await import('@/app/api/visitas/route')

    await GET(pedido('?data=2026-08-25&todos=1'))

    expect(listarDoDia).toHaveBeenCalledWith(
      expect.anything(),
      { data: '2026-08-25', usuarioId: undefined }
    )
  })

  it('vendedor que force todos=1 continua vendo só as próprias', async () => {
    const { GET } = await import('@/app/api/visitas/route')

    await GET(pedido('?data=2026-08-25&todos=1'))

    expect(listarDoDia).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ usuarioId: 'u1' })
    )
  })

  it('sem data na query, usa hoje', async () => {
    const { GET } = await import('@/app/api/visitas/route')

    await GET(pedido())

    const hoje = new Date().toISOString().slice(0, 10)
    expect(listarDoDia).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: hoje })
    )
  })
})
