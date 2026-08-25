import { describe, it, expect, vi, beforeEach } from 'vitest'

const confirmarLogin = vi.fn()
const criarSessao = vi.fn()
const excedeuTentativas = vi.fn()
const registrarTentativa = vi.fn()

vi.mock('@/lib/auth/senha', () => ({ provedorSenha: { confirmarLogin, iniciarLogin: vi.fn() } }))
vi.mock('@/lib/auth/sessao', () => ({ criarSessao, encerrarSessao: vi.fn(), lerSessao: vi.fn() }))
vi.mock('@/lib/auth/limite', () => ({ excedeuTentativas, registrarTentativa }))

function pedido(corpo: unknown) {
  return new Request('http://local/api/login', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/login', () => {
  beforeEach(() => {
    confirmarLogin.mockReset()
    criarSessao.mockReset()
    registrarTentativa.mockReset()
    excedeuTentativas.mockReset()
    excedeuTentativas.mockResolvedValue(false)
  })

  it('cria a sessão quando as credenciais conferem', async () => {
    confirmarLogin.mockResolvedValue({ id: 'u1', papel: 'vendedor' })
    const { POST } = await import('@/app/api/login/route')

    const r = await POST(pedido({ telefone: '21977237528', senha: 'segredo123' }))

    expect(r.status).toBe(200)
    expect(criarSessao).toHaveBeenCalledWith('u1')
  })

  it('responde 401 sem dizer se foi o telefone ou a senha', async () => {
    // Dizer "esse telefone não existe" entregaria a lista de quem trabalha
    // aqui para quem estiver testando números.
    confirmarLogin.mockResolvedValue(null)
    const { POST } = await import('@/app/api/login/route')

    const r = await POST(pedido({ telefone: '21977237528', senha: 'errada' }))
    const corpo = await r.json()

    expect(r.status).toBe(401)
    expect(corpo.erro).toBe('Telefone ou senha incorretos')
    expect(criarSessao).not.toHaveBeenCalled()
  })

  it('responde 400 quando o corpo não tem o formato esperado', async () => {
    const { POST } = await import('@/app/api/login/route')

    const r = await POST(pedido({ telefone: '' }))

    expect(r.status).toBe(400)
    expect(confirmarLogin).not.toHaveBeenCalled()
  })

  it('registra cada tentativa fracassada', async () => {
    confirmarLogin.mockResolvedValue(null)
    const { POST } = await import('@/app/api/login/route')

    await POST(pedido({ telefone: '21977237528', senha: 'errada' }))

    expect(registrarTentativa).toHaveBeenCalledWith('5521977237528')
  })

  it('responde 429 e nem testa a senha quando o limite estourou', async () => {
    excedeuTentativas.mockResolvedValue(true)
    const { POST } = await import('@/app/api/login/route')

    const r = await POST(pedido({ telefone: '21977237528', senha: 'chute' }))

    expect(r.status).toBe(429)
    expect(confirmarLogin).not.toHaveBeenCalled()
  })

  it('não registra tentativa quando o login dá certo', async () => {
    confirmarLogin.mockResolvedValue({ id: 'u1', papel: 'vendedor' })
    const { POST } = await import('@/app/api/login/route')

    await POST(pedido({ telefone: '21977237528', senha: 'segredo123' }))

    expect(registrarTentativa).not.toHaveBeenCalled()
  })

  it('responde 400 quando o corpo não é JSON válido', async () => {
    const { POST } = await import('@/app/api/login/route')

    const r = await POST(
      new Request('http://local/api/login', {
        method: 'POST',
        body: 'isto não é json',
        headers: { 'content-type': 'application/json' },
      })
    )

    expect(r.status).toBe(400)
  })
})
