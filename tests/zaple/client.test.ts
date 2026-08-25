import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

function respostaJson(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * O corpo de uma Response só pode ser lido uma vez. Usar mockResolvedValue
 * devolveria o mesmo objeto em toda chamada, e a segunda leitura estouraria
 * "Body has already been read" — mascarando o que o teste quer verificar.
 */
function sempreResponde(corpo: unknown, status = 200) {
  return vi.fn().mockImplementation(async () => respostaJson(corpo, status))
}

describe('cliente Zaple', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ZAPLE_TOKEN = 'pn_teste'
    process.env.ZAPLE_BASE_URL = 'https://api.exemplo'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('envia o token no header e monta a URL', async () => {
    const fetchFalso = sempreResponde({ ok: true })
    vi.stubGlobal('fetch', fetchFalso)
    const { zapleGet } = await import('@/lib/zaple/client')

    await zapleGet('/crm/v2/panel')

    const [url, init] = fetchFalso.mock.calls[0]
    expect(url).toBe('https://api.exemplo/crm/v2/panel')
    expect(init.headers.Authorization).toBe('Bearer pn_teste')
  })

  it('repete parâmetros de array em vez de juntar com vírgula', async () => {
    const fetchFalso = sempreResponde({ ok: true })
    vi.stubGlobal('fetch', fetchFalso)
    const { zapleGet } = await import('@/lib/zaple/client')

    await zapleGet('/crm/v2/panel/card', { IncludeDetails: ['Contacts', 'ResponsibleUser'] })

    expect(fetchFalso.mock.calls[0][0]).toBe(
      'https://api.exemplo/crm/v2/panel/card?IncludeDetails=Contacts&IncludeDetails=ResponsibleUser'
    )
  })

  it('omite parâmetros indefinidos', async () => {
    const fetchFalso = sempreResponde({ ok: true })
    vi.stubGlobal('fetch', fetchFalso)
    const { zapleGet } = await import('@/lib/zaple/client')

    await zapleGet('/crm/v2/panel/card', { PanelId: 'abc', StepId: undefined })

    expect(fetchFalso.mock.calls[0][0]).toBe('https://api.exemplo/crm/v2/panel/card?PanelId=abc')
  })

  it('trata erro sinalizado no corpo mesmo com HTTP 200', async () => {
    // Formato real observado em 2026-08-24 contra a API de produção.
    const fetchFalso = sempreResponde({
      httpStatusCode: 404,
      error: true,
      key: 'ERROR_UNAUTHORIZED',
      text: 'Acesso negado',
    })
    vi.stubGlobal('fetch', fetchFalso)
    const { zapleGet } = await import('@/lib/zaple/client')
    const { ZapleError } = await import('@/lib/zaple/erros')

    await expect(zapleGet('/core/v1/message')).rejects.toBeInstanceOf(ZapleError)
    await expect(zapleGet('/core/v1/message')).rejects.toMatchObject({
      key: 'ERROR_UNAUTHORIZED',
      autorizacao: true,
    })
  })

  it('não repete a chamada quando o erro é de autorização', async () => {
    const fetchFalso = sempreResponde({ error: true, key: 'ERROR_UNAUTHORIZED', text: 'Acesso negado' })
    vi.stubGlobal('fetch', fetchFalso)
    const { zapleGet } = await import('@/lib/zaple/client')

    await expect(zapleGet('/core/v1/message')).rejects.toThrow()
    expect(fetchFalso).toHaveBeenCalledTimes(1)
  })

  it('repete a chamada em erro 5xx e devolve o sucesso', async () => {
    const fetchFalso = vi
      .fn()
      .mockImplementationOnce(async () => respostaJson({ error: true, key: 'INTERNAL' }, 500))
      .mockImplementationOnce(async () => respostaJson({ id: 'ok' }))
    vi.stubGlobal('fetch', fetchFalso)
    const { zapleGet } = await import('@/lib/zaple/client')

    const r = await zapleGet<{ id: string }>('/crm/v2/panel')

    expect(r.id).toBe('ok')
    expect(fetchFalso).toHaveBeenCalledTimes(2)
  })

  it('desiste após o teto de tentativas', async () => {
    const fetchFalso = sempreResponde({ error: true, key: 'INTERNAL' }, 500)
    vi.stubGlobal('fetch', fetchFalso)
    const { zapleGet } = await import('@/lib/zaple/client')

    await expect(zapleGet('/crm/v2/panel')).rejects.toThrow()
    expect(fetchFalso).toHaveBeenCalledTimes(3)
  })
})
