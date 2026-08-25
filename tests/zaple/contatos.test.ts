import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/** Recorte fiel de GET /core/v1/contact capturado em 2026-08-24. */
const CONTATO_REAL = {
  id: 'c9b9a216-9707-4c45-acca-15fec0486051',
  name: 'VITOR HUGO',
  phoneNumber: '+55|21977237528',
  phoneNumberFormatted: '(21) 97723-7528',
  email: 'supervisao.vendas@altaperformancerj.com.br',
  status: 'ACTIVE',
}

function stub(corpo: unknown, status = 200) {
  const f = vi.fn().mockImplementation(
    async () =>
      new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })
  )
  vi.stubGlobal('fetch', f)
  return f
}

describe('normalizarTelefone', () => {
  beforeEach(() => vi.resetModules())

  it('tira máscara e acrescenta o DDI do Brasil', async () => {
    const { normalizarTelefone } = await import('@/lib/zaple/contatos')
    expect(normalizarTelefone('(21) 97723-7528')).toBe('5521977237528')
  })

  it('não duplica o DDI quando já vem informado', async () => {
    const { normalizarTelefone } = await import('@/lib/zaple/contatos')
    expect(normalizarTelefone('+55 21 97723-7528')).toBe('5521977237528')
    expect(normalizarTelefone('5521977237528')).toBe('5521977237528')
  })

  it('entende o formato com pipe que o Zaple armazena', async () => {
    const { normalizarTelefone } = await import('@/lib/zaple/contatos')
    expect(normalizarTelefone('+55|21977237528')).toBe('5521977237528')
  })

  it('não confunde o DDD 55 do Rio Grande do Sul com o DDI', async () => {
    // (55) 99988-7766 tem 11 dígitos e começa com "55". Se a regra olhasse só
    // o prefixo, o número sairia sem DDI e o contato nunca seria encontrado.
    const { normalizarTelefone } = await import('@/lib/zaple/contatos')
    expect(normalizarTelefone('(55) 99988-7766')).toBe('5555999887766')
  })
})

describe('contatos', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ZAPLE_TOKEN = 'pn_teste'
    process.env.ZAPLE_BASE_URL = 'https://api.exemplo'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('busca por nome usando o endpoint de filtro, que é POST', async () => {
    const f = stub({ items: [CONTATO_REAL], totalItems: 1, hasMorePages: false })
    const { buscarContatosPorNome } = await import('@/lib/zaple/contatos')

    const achados = await buscarContatosPorNome('VITOR')

    expect(f.mock.calls[0][0]).toContain('/core/v1/contact/filter')
    expect(f.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ name: 'VITOR' })
    expect(achados[0]).toEqual({
      id: 'c9b9a216-9707-4c45-acca-15fec0486051',
      nome: 'VITOR HUGO',
      telefone: '(21) 97723-7528',
      email: 'supervisao.vendas@altaperformancerj.com.br',
    })
  })

  it('busca por telefone normalizando antes de montar a URL', async () => {
    const f = stub(CONTATO_REAL)
    const { buscarContatoPorTelefone } = await import('@/lib/zaple/contatos')

    const achado = await buscarContatoPorTelefone('(21) 97723-7528')

    expect(f.mock.calls[0][0]).toContain('/core/v1/contact/phoneNumber/5521977237528')
    expect(achado?.nome).toBe('VITOR HUGO')
  })

  it('devolve null quando o telefone não existe, em vez de estourar', async () => {
    // Resposta real capturada em 2026-08-24: a API usa HTTP 500 e FORM_ERROR
    // para dizer "não existe", com httpStatusCode vindo como string.
    stub(
      {
        customData: null,
        httpStatusCode: 'INTERNALSERVERERROR',
        error: true,
        key: 'FORM_ERROR',
        text: 'Contato não encontrado',
        isUnsolvableError: false,
      },
      500
    )
    const { buscarContatoPorTelefone } = await import('@/lib/zaple/contatos')

    expect(await buscarContatoPorTelefone('21999999999')).toBeNull()
  })

  it('não gasta retentativas quando o contato apenas não existe', async () => {
    // Sem a guarda de "não encontrado", este caminho — o mais comum ao criar
    // visita para cliente novo — custaria três chamadas e ~900ms de espera.
    const f = stub(
      { httpStatusCode: 'INTERNALSERVERERROR', error: true, key: 'FORM_ERROR', text: 'Contato não encontrado' },
      500
    )
    const { buscarContatoPorTelefone } = await import('@/lib/zaple/contatos')

    await buscarContatoPorTelefone('21999999999')

    expect(f).toHaveBeenCalledTimes(1)
  })

  it('propaga erro de autorização em vez de escondê-lo como null', async () => {
    // Engolir isso como "não achei" esconderia um token quebrado por semanas.
    stub({ error: true, key: 'ERROR_UNAUTHORIZED', text: 'Acesso negado' })
    const { buscarContatoPorTelefone } = await import('@/lib/zaple/contatos')

    await expect(buscarContatoPorTelefone('21999999999')).rejects.toThrow('Acesso negado')
  })

  it('cria contato com o telefone normalizado', async () => {
    const f = stub(CONTATO_REAL)
    const { criarContato } = await import('@/lib/zaple/contatos')

    await criarContato({ nome: 'Padaria do Zé', telefone: '(21) 98888-7777' })

    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({
      name: 'Padaria do Zé',
      phoneNumber: '5521988887777',
    })
  })
})
