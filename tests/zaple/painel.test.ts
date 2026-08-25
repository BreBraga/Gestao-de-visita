import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const PAINEL_ID = 'fd605396-cc03-4e8a-bf7d-aa2b91594cf1'

/**
 * Recorte fiel de GET /crm/v2/panel?IncludeDetails=Steps capturado em
 * 2026-08-24. As etapas vêm fora de ordem, como na resposta real, e há outro
 * painel na lista — a implementação precisa achar o certo entre os 18 da conta.
 */
const PAGINA_REAL = {
  items: [
    {
      id: '8faecbaf-87d2-49a5-8c7a-7e372e39db2f',
      title: 'PAINEL DE VENDAS',
      steps: [
        { id: 'aaaa0000-0000-0000-0000-000000000001', title: 'NOVO LEAD', position: 1.0, isInitial: true, isFinal: false },
      ],
    },
    {
      id: PAINEL_ID,
      title: 'PAINEL DE VISITAS',
      steps: [
        { id: '8d008670-0b2a-4349-9375-716e62b0ef58', title: 'Visita', position: 2.0, isInitial: false, isFinal: false },
        { id: 'e5b1546c-f374-4d85-a8a2-25e424211c48', title: 'Prospecção', position: 1.0, isInitial: true, isFinal: false },
        { id: '45a0d42f-612c-43dc-a139-42a13fa22674', title: 'Concluído', position: 4.0, isInitial: false, isFinal: true },
        { id: 'e76733df-0a6d-441c-bb7b-7c0969f3bd89', title: 'RECORRENTE', position: 3.0, isInitial: false, isFinal: false },
      ],
    },
  ],
}

function sempreResponde(corpo: unknown) {
  return vi.fn().mockImplementation(
    async () => new Response(JSON.stringify(corpo), { headers: { 'content-type': 'application/json' } })
  )
}

describe('etapas do painel', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ZAPLE_TOKEN = 'pn_teste'
    process.env.ZAPLE_BASE_URL = 'https://api.exemplo'
    process.env.ZAPLE_PANEL_ID = PAINEL_ID
  })
  afterEach(() => vi.unstubAllGlobals())

  it('devolve as etapas ordenadas por posição, não pela ordem da API', async () => {
    vi.stubGlobal('fetch', sempreResponde(PAGINA_REAL))
    const { listarEtapas } = await import('@/lib/zaple/painel')

    const etapas = await listarEtapas()

    expect(etapas.map((e) => e.titulo)).toEqual(['Prospecção', 'Visita', 'RECORRENTE', 'Concluído'])
  })

  it('marca a etapa inicial e a final', async () => {
    vi.stubGlobal('fetch', sempreResponde(PAGINA_REAL))
    const { listarEtapas } = await import('@/lib/zaple/painel')

    const etapas = await listarEtapas()

    expect(etapas[0]).toMatchObject({ titulo: 'Prospecção', inicial: true, final: false })
    expect(etapas[3]).toMatchObject({ titulo: 'Concluído', inicial: false, final: true })
  })

  it('pede as etapas na listagem v2, porque o detalhe v1 devolve steps nulo', async () => {
    const fetchFalso = sempreResponde(PAGINA_REAL)
    vi.stubGlobal('fetch', fetchFalso)
    const { listarEtapas } = await import('@/lib/zaple/painel')

    await listarEtapas()

    const url = fetchFalso.mock.calls[0][0] as string
    expect(url).toContain('/crm/v2/panel')
    expect(url).toContain('IncludeDetails=Steps')
  })

  it('não confunde o painel de visitas com os outros da conta', async () => {
    vi.stubGlobal('fetch', sempreResponde(PAGINA_REAL))
    const { listarEtapas } = await import('@/lib/zaple/painel')

    const etapas = await listarEtapas()

    expect(etapas.map((e) => e.titulo)).not.toContain('NOVO LEAD')
  })

  it('falha alto quando o painel configurado não existe, em vez de devolver lista vazia', async () => {
    // Lista vazia silenciosa viraria "kanban sem nenhuma etapa" na tela, e o
    // vendedor não teria como saber que o ZAPLE_PANEL_ID está errado.
    process.env.ZAPLE_PANEL_ID = '00000000-0000-0000-0000-000000000000'
    vi.stubGlobal('fetch', sempreResponde(PAGINA_REAL))
    const { listarEtapas } = await import('@/lib/zaple/painel')

    await expect(listarEtapas()).rejects.toThrow('não encontrado')
  })
})
