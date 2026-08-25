import { describe, it, expect, vi, beforeEach } from 'vitest'

const armazem = new Map<string, { value: string }>()

type OpcoesCookie = { httpOnly?: boolean; sameSite?: string; path?: string; secure?: boolean; maxAge?: number }

const set = vi.fn((n: string, v: string, _opcoes?: OpcoesCookie) => {
  armazem.set(n, { value: v })
})

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (n: string) => armazem.get(n),
    set,
    delete: (n: string) => armazem.delete(n),
  }),
}))

describe('sessão', () => {
  beforeEach(() => {
    armazem.clear()
    set.mockClear()
    process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-bytes-aqui'
  })

  it('grava e lê o id do usuário', async () => {
    const { criarSessao, lerSessao } = await import('@/lib/auth/sessao')
    await criarSessao('u1')
    expect(await lerSessao()).toBe('u1')
  })

  it('grava o cookie como httpOnly, para o JavaScript da página não alcançá-lo', async () => {
    const { criarSessao } = await import('@/lib/auth/sessao')

    await criarSessao('u1')

    expect(set.mock.calls[0][2]).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' })
  })

  it('devolve null quando não há cookie', async () => {
    const { lerSessao } = await import('@/lib/auth/sessao')
    expect(await lerSessao()).toBeNull()
  })

  it('recusa token adulterado', async () => {
    const { lerSessao } = await import('@/lib/auth/sessao')
    armazem.set('sessao', { value: 'eyJhbGciOiJIUzI1NiJ9.mentira.assinatura' })
    expect(await lerSessao()).toBeNull()
  })

  it('recusa token assinado com outro segredo', async () => {
    // Trocar o SESSION_SECRET precisa invalidar as sessões existentes.
    const { criarSessao, lerSessao } = await import('@/lib/auth/sessao')
    await criarSessao('u1')

    process.env.SESSION_SECRET = 'um-segredo-completamente-diferente-do-outro'

    expect(await lerSessao()).toBeNull()
  })

  it('encerrar apaga o cookie', async () => {
    const { criarSessao, encerrarSessao, lerSessao } = await import('@/lib/auth/sessao')
    await criarSessao('u1')
    await encerrarSessao()
    expect(await lerSessao()).toBeNull()
  })
})
