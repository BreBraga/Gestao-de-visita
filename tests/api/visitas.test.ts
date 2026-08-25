import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const listarVisitas = vi.fn()
const criarVisita = vi.fn()
const listarEtapas = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/zaple/visitas', () => ({ listarVisitas, criarVisita }))
vi.mock('@/lib/zaple/painel', () => ({ listarEtapas, painelId: () => 'p1' }))

const VENDEDOR = { id: 'u1', papel: 'vendedor', zapleUserId: 'agente-1' }
const GESTOR = { id: 'g1', papel: 'gestor', zapleUserId: 'agente-9' }

describe('GET /api/visitas', () => {
  beforeEach(() => {
    exigirUsuario.mockReset()
    listarVisitas.mockReset()
    listarVisitas.mockResolvedValue({ itens: [], total: 0, temMais: false })
  })

  it('vendedor só recebe as visitas dele', async () => {
    exigirUsuario.mockResolvedValue(VENDEDOR)
    const { GET } = await import('@/app/api/visitas/route')

    await GET(new Request('http://local/api/visitas'))

    expect(listarVisitas).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: 'agente-1' }))
  })

  it('vendedor não escapa do filtro pedindo todos', async () => {
    exigirUsuario.mockResolvedValue(VENDEDOR)
    const { GET } = await import('@/app/api/visitas/route')

    await GET(new Request('http://local/api/visitas?todos=1'))

    expect(listarVisitas).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: 'agente-1' }))
  })

  it('gestor pedindo todos vê o painel inteiro', async () => {
    exigirUsuario.mockResolvedValue(GESTOR)
    const { GET } = await import('@/app/api/visitas/route')

    await GET(new Request('http://local/api/visitas?todos=1'))

    expect(listarVisitas).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: undefined }))
  })

  it('gestor sem pedir todos vê apenas as próprias', async () => {
    exigirUsuario.mockResolvedValue(GESTOR)
    const { GET } = await import('@/app/api/visitas/route')

    await GET(new Request('http://local/api/visitas'))

    expect(listarVisitas).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: 'agente-9' }))
  })
})
