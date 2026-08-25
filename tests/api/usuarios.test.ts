import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirGestor = vi.fn()
const criarUsuario = vi.fn()
const listarAgentes = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirGestor, exigirUsuario: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/auth/usuarios', () => ({
  criarUsuario,
  listarUsuarios: vi.fn().mockResolvedValue([]),
  alterarUsuario: vi.fn(),
}))
vi.mock('@/lib/zaple/agentes', () => ({ listarAgentes }))

function pedido(corpo: unknown) {
  return new Request('http://local/api/usuarios', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })
}

// O card traz o userId do agente, não o id — o cadastro precisa guardar o userId.
const AGENTE_ID = '79e78c4b-3261-4b82-9010-a471cc005787'
const AGENTE_USER_ID = '864b4306-0dd9-4039-ae6a-1c29f4c901c5'

const VALIDO = {
  nome: 'Danilo',
  telefone: '(21) 97723-7528',
  senha: 'segredo123',
  zapleUserId: AGENTE_USER_ID,
  papel: 'vendedor',
}

describe('POST /api/usuarios', () => {
  beforeEach(() => {
    exigirGestor.mockReset()
    exigirGestor.mockResolvedValue({ id: 'g1', papel: 'gestor' })
    listarAgentes.mockReset()
    listarAgentes.mockResolvedValue([
      { id: AGENTE_ID, userId: AGENTE_USER_ID, nome: 'Danilo', email: null, telefone: null },
    ])
    criarUsuario.mockReset()
    criarUsuario.mockResolvedValue({ id: 'u1' })
  })

  it('cria o usuário quando o agente existe no Zaple', async () => {
    const { POST } = await import('@/app/api/usuarios/route')

    const r = await POST(pedido(VALIDO))

    expect(r.status).toBe(201)
    expect(criarUsuario).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Danilo' }))
  })

  it('recusa agente do Zaple inexistente', async () => {
    // Vincular a um agente que não existe cria um vendedor que nunca vê
    // visita, e o sintoma só aparece dias depois, em campo.
    const { POST } = await import('@/app/api/usuarios/route')

    const r = await POST(pedido({ ...VALIDO, zapleUserId: '00000000-0000-0000-0000-000000000000' }))

    expect(r.status).toBe(400)
    expect((await r.json()).erro).toContain('agente')
    expect(criarUsuario).not.toHaveBeenCalled()
  })

  it('recusa o id do agente quando o esperado é o userId', async () => {
    // Este é o erro que deixaria o kanban do vendedor vazio para sempre, sem
    // nenhum sintoma no cadastro.
    const { POST } = await import('@/app/api/usuarios/route')

    const r = await POST(pedido({ ...VALIDO, zapleUserId: AGENTE_ID }))

    expect(r.status).toBe(400)
    expect(criarUsuario).not.toHaveBeenCalled()
  })

  it('exige senha com pelo menos 8 caracteres', async () => {
    const { POST } = await import('@/app/api/usuarios/route')

    const r = await POST(pedido({ ...VALIDO, senha: 'curta' }))

    expect(r.status).toBe(400)
    expect(criarUsuario).not.toHaveBeenCalled()
  })

  it('devolve 409 quando o telefone já está cadastrado', async () => {
    criarUsuario.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }))
    const { POST } = await import('@/app/api/usuarios/route')

    const r = await POST(pedido(VALIDO))

    expect(r.status).toBe(409)
  })

  it('nunca devolve o hash da senha na listagem', async () => {
    const { listarUsuarios } = await import('@/lib/auth/usuarios')
    vi.mocked(listarUsuarios).mockResolvedValue([
      { id: 'u1', nome: 'Danilo', senhaHash: '$2a$12$segredo' } as never,
    ])
    const { GET } = await import('@/app/api/usuarios/route')

    const corpo = await (await GET()).json()

    expect(JSON.stringify(corpo)).not.toContain('$2a$12$segredo')
    expect(corpo.usuarios[0]).not.toHaveProperty('senhaHash')
  })
})
