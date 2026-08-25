import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const PAINEL_ID = 'fd605396-cc03-4e8a-bf7d-aa2b91594cf1'

/** Recorte fiel de GET /crm/v2/panel/card capturado em 2026-08-24. */
const CARD_REAL = {
  status: 'OPEN',
  id: '3c297d05-eca5-4522-8b19-6c0656b750f4',
  createdAt: '2026-08-24T12:45:57.590904Z',
  updatedAt: '2026-08-24T14:57:41.009257Z',
  panelId: PAINEL_ID,
  stepId: '8d008670-0b2a-4349-9375-716e62b0ef58',
  stepTitle: 'Visita',
  position: 0.25,
  title: 'Padaria do Zé',
  description: null,
  key: 'PDV-1',
  number: 1,
  dueDate: null,
  isOverdue: false,
  monetaryAmount: 500.0,
  responsibleUserId: null,
  responsibleUser: null,
  contactIds: [],
  contacts: [],
  customFields: null,
  metadata: null,
}

const PAGINA_REAL = {
  items: [CARD_REAL],
  totalItems: 1,
  totalPages: 1,
  hasMorePages: false,
  pageNumber: 1,
  pageSize: 15,
}

function stub(corpo: unknown) {
  const f = vi.fn().mockImplementation(
    async () => new Response(JSON.stringify(corpo), { headers: { 'content-type': 'application/json' } })
  )
  vi.stubGlobal('fetch', f)
  return f
}

describe('visitas', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ZAPLE_TOKEN = 'pn_teste'
    process.env.ZAPLE_BASE_URL = 'https://api.exemplo'
    process.env.ZAPLE_PANEL_ID = PAINEL_ID
  })
  afterEach(() => vi.unstubAllGlobals())

  it('converte o card da API para o formato do domínio', async () => {
    stub(PAGINA_REAL)
    const { listarVisitas } = await import('@/lib/zaple/visitas')

    const { itens, total, temMais } = await listarVisitas({})

    expect(total).toBe(1)
    expect(temMais).toBe(false)
    expect(itens[0]).toMatchObject({
      id: '3c297d05-eca5-4522-8b19-6c0656b750f4',
      chave: 'PDV-1',
      numero: 1,
      titulo: 'Padaria do Zé',
      etapaId: '8d008670-0b2a-4349-9375-716e62b0ef58',
      etapaTitulo: 'Visita',
      prazo: null,
      atrasada: false,
      responsavelId: null,
      contatos: [],
    })
  })

  it('sempre pede os detalhes que a tela precisa', async () => {
    const f = stub(PAGINA_REAL)
    const { listarVisitas } = await import('@/lib/zaple/visitas')

    await listarVisitas({})

    const url = f.mock.calls[0][0] as string
    expect(url).toContain('IncludeDetails=StepTitle')
    expect(url).toContain('IncludeDetails=ResponsibleUser')
    expect(url).toContain('IncludeDetails=Contacts')
    expect(url).toContain(`PanelId=${PAINEL_ID}`)
  })

  it('filtra por responsável, por etapa e por texto', async () => {
    const f = stub(PAGINA_REAL)
    const { listarVisitas } = await import('@/lib/zaple/visitas')

    await listarVisitas({ responsavelId: 'agente-1', etapaId: 'etapa-1', busca: 'padaria' })

    const url = f.mock.calls[0][0] as string
    expect(url).toContain('ResponsibleUserId=agente-1')
    expect(url).toContain('StepId=etapa-1')
    expect(url).toContain('TextFilter=padaria')
  })

  it('limita o tamanho de página ao máximo aceito pela API', async () => {
    const f = stub(PAGINA_REAL)
    const { listarVisitas } = await import('@/lib/zaple/visitas')

    await listarVisitas({ tamanho: 500 })

    expect(f.mock.calls[0][0]).toContain('PageSize=100')
  })

  it('só busca visitas abertas, não arquivadas', async () => {
    const f = stub(PAGINA_REAL)
    const { listarVisitas } = await import('@/lib/zaple/visitas')

    await listarVisitas({})

    expect(f.mock.calls[0][0]).toContain('Statuses=OPEN')
  })

  it('cria a visita com etapa, título, responsável e contatos', async () => {
    const f = stub(CARD_REAL)
    const { criarVisita } = await import('@/lib/zaple/visitas')

    await criarVisita({
      etapaId: 'e5b1546c-f374-4d85-a8a2-25e424211c48',
      titulo: 'Padaria do Zé',
      responsavelId: 'agente-1',
      contatoIds: ['contato-1'],
      prazo: '2026-09-01T13:00:00Z',
    })

    const corpo = JSON.parse(f.mock.calls[0][1].body)
    expect(corpo).toEqual({
      stepId: 'e5b1546c-f374-4d85-a8a2-25e424211c48',
      title: 'Padaria do Zé',
      responsibleUserId: 'agente-1',
      contactIds: ['contato-1'],
      dueDate: '2026-09-01T13:00:00Z',
    })
  })

  it('recusa criar visita sem responsável ou sem contato', async () => {
    stub(CARD_REAL)
    const { criarVisita } = await import('@/lib/zaple/visitas')

    await expect(
      criarVisita({ etapaId: 'etapa-1', titulo: 'X', responsavelId: '', contatoIds: ['c1'] })
    ).rejects.toThrow('responsável')

    await expect(
      criarVisita({ etapaId: 'etapa-1', titulo: 'X', responsavelId: 'a1', contatoIds: [] })
    ).rejects.toThrow('contato')
  })

  it('declara em fields exatamente o que está alterando', async () => {
    const f = stub(CARD_REAL)
    const { atualizarVisita } = await import('@/lib/zaple/visitas')

    await atualizarVisita('card-1', { etapaId: 'etapa-2', prazo: '2026-09-10T12:00:00Z' })

    const corpo = JSON.parse(f.mock.calls[0][1].body)
    expect(corpo.fields.sort()).toEqual(['DueDate', 'StepId'])
    expect(corpo.stepId).toBe('etapa-2')
    expect(corpo.dueDate).toBe('2026-09-10T12:00:00Z')
    expect(f.mock.calls[0][1].method).toBe('PUT')
    expect(f.mock.calls[0][0]).toContain('/crm/v3/panel/card/card-1')
  })

  it('permite limpar o prazo enviando null com o campo declarado', async () => {
    const f = stub(CARD_REAL)
    const { atualizarVisita } = await import('@/lib/zaple/visitas')

    await atualizarVisita('card-1', { prazo: null })

    const corpo = JSON.parse(f.mock.calls[0][1].body)
    expect(corpo.fields).toEqual(['DueDate'])
    expect(corpo.dueDate).toBeNull()
  })

  it('recusa atualização vazia em vez de enviar requisição inútil', async () => {
    const f = stub(CARD_REAL)
    const { atualizarVisita } = await import('@/lib/zaple/visitas')

    await expect(atualizarVisita('card-1', {})).rejects.toThrow('nada para atualizar')
    expect(f).not.toHaveBeenCalled()
  })

  it('mover etapa é uma atualização só do StepId', async () => {
    const f = stub(CARD_REAL)
    const { moverEtapa } = await import('@/lib/zaple/visitas')

    await moverEtapa('card-1', 'etapa-3')

    const corpo = JSON.parse(f.mock.calls[0][1].body)
    expect(corpo.fields).toEqual(['StepId'])
    expect(corpo.stepId).toBe('etapa-3')
  })
})
