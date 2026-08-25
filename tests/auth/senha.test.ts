import { describe, it, expect, vi, beforeEach } from 'vitest'

const usuarioFalso = {
  id: 'u1',
  nome: 'Danilo',
  telefone: '5521977237528',
  email: null,
  senhaHash: '',
  zapleUserId: '79e78c4b-3261-4b82-9010-a471cc005787',
  papel: 'vendedor' as const,
  ativo: true,
  criadoEm: new Date(),
}

const buscarPorTelefone = vi.fn()
vi.mock('@/lib/auth/repositorio', () => ({ buscarPorTelefone, buscarPorId: vi.fn() }))

describe('login por senha', () => {
  beforeEach(() => {
    buscarPorTelefone.mockReset()
  })

  it('aceita a senha correta e devolve o usuário', async () => {
    const { gerarHash, provedorSenha } = await import('@/lib/auth/senha')
    buscarPorTelefone.mockResolvedValue({ ...usuarioFalso, senhaHash: await gerarHash('segredo123') })

    const u = await provedorSenha.confirmarLogin('(21) 97723-7528', 'segredo123')

    expect(u?.id).toBe('u1')
  })

  it('recusa a senha errada', async () => {
    const { gerarHash, provedorSenha } = await import('@/lib/auth/senha')
    buscarPorTelefone.mockResolvedValue({ ...usuarioFalso, senhaHash: await gerarHash('segredo123') })

    expect(await provedorSenha.confirmarLogin('5521977237528', 'errada')).toBeNull()
  })

  it('busca pelo telefone normalizado, aceitando o que o usuário digitar', async () => {
    const { gerarHash, provedorSenha } = await import('@/lib/auth/senha')
    buscarPorTelefone.mockResolvedValue({ ...usuarioFalso, senhaHash: await gerarHash('s') })

    await provedorSenha.confirmarLogin('(21) 97723-7528', 's')

    expect(buscarPorTelefone).toHaveBeenCalledWith('5521977237528')
  })

  it('recusa usuário desativado mesmo com a senha certa', async () => {
    const { gerarHash, provedorSenha } = await import('@/lib/auth/senha')
    buscarPorTelefone.mockResolvedValue({
      ...usuarioFalso,
      ativo: false,
      senhaHash: await gerarHash('s'),
    })

    expect(await provedorSenha.confirmarLogin('5521977237528', 's')).toBeNull()
  })

  it('recusa telefone inexistente sem vazar que ele não existe', async () => {
    const { provedorSenha } = await import('@/lib/auth/senha')
    buscarPorTelefone.mockResolvedValue(null)

    expect(await provedorSenha.confirmarLogin('5521900000000', 'qualquer')).toBeNull()
  })

  it('nunca guarda a senha em texto claro', async () => {
    const { gerarHash } = await import('@/lib/auth/senha')
    const hash = await gerarHash('segredo123')
    expect(hash).not.toContain('segredo123')
    expect(hash.startsWith('$2')).toBe(true)
  })
})
