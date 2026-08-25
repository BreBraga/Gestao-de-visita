import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirGestor = vi.fn()
const listarNaoSincronizadas = vi.fn()
const sincronizar = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirGestor, exigirUsuario: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/visita/repositorio', () => ({ listarNaoSincronizadas, db: {} }))
vi.mock('@/lib/visita/sincronizador', () => ({ sincronizar }))

describe('/api/sincronismo', () => {
  beforeEach(() => {
    exigirGestor.mockReset()
    exigirGestor.mockResolvedValue({ id: 'g1', papel: 'gestor' })
    listarNaoSincronizadas.mockReset()
    listarNaoSincronizadas.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }])
    sincronizar.mockReset()
    sincronizar.mockResolvedValue({ ok: true })
  })

  it('lista as visitas que não chegaram ao Zaple', async () => {
    const { GET } = await import('@/app/api/sincronismo/route')

    const r = await GET()

    expect((await r.json()).pendentes).toHaveLength(2)
  })

  it('reprocessa todas e conta os sucessos', async () => {
    sincronizar.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, erro: 'x' })
    const { POST } = await import('@/app/api/sincronismo/route')

    const corpo = await (await POST()).json()

    expect(corpo).toEqual({ tentadas: 2, sincronizadas: 1 })
  })
})
