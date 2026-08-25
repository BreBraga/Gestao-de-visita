import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Recorte fiel de GET /core/v1/agent capturado em 2026-08-24: array cru, sem
 * envelope de paginação, e com `id` e `userId` distintos.
 */
const AGENTES_REAIS = [
  {
    id: '79e78c4b-3261-4b82-9010-a471cc005787',
    userId: '864b4306-0dd9-4039-ae6a-1c29f4c901c5',
    name: 'Danilo',
    email: 'televendas@altaperformancerj.com.br',
    phoneNumber: '+55|21999998888',
    phoneNumberFormatted: '(21) 99999-8888',
    profile: 'AGENT',
  },
  {
    id: '42b8cbc0-d047-42b6-ae10-1b5447d8c62e',
    userId: 'ec6f1653-33eb-41b2-a57c-07bb84cd7f34',
    name: 'Zilda',
    email: null,
    phoneNumber: '+55|21977469888',
    phoneNumberFormatted: '(21) 97746-9888',
    profile: 'AGENT',
  },
]

function stub(corpo: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(
      async () => new Response(JSON.stringify(corpo), { headers: { 'content-type': 'application/json' } })
    )
  )
}

describe('agentes', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ZAPLE_TOKEN = 'pn_teste'
    process.env.ZAPLE_BASE_URL = 'https://api.exemplo'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('lê o array cru e devolve agentes ordenados por nome', async () => {
    stub(AGENTES_REAIS)
    const { listarAgentes } = await import('@/lib/zaple/agentes')

    const agentes = await listarAgentes()

    expect(agentes.map((a) => a.nome)).toEqual(['Danilo', 'Zilda'])
    expect(agentes[1].email).toBeNull()
  })

  it('expõe o userId, que é o id que os cards realmente usam', async () => {
    // Os cards trazem responsibleUserId = agent.userId, NÃO agent.id.
    // Confundir os dois deixa o kanban de todo vendedor vazio, e o sintoma
    // é silencioso: a API responde 200 com zero itens.
    stub(AGENTES_REAIS)
    const { listarAgentes } = await import('@/lib/zaple/agentes')

    const [danilo] = await listarAgentes()

    expect(danilo.userId).toBe('864b4306-0dd9-4039-ae6a-1c29f4c901c5')
    expect(danilo.id).toBe('79e78c4b-3261-4b82-9010-a471cc005787')
    expect(danilo.userId).not.toBe(danilo.id)
  })

  it('traz o telefone formatado, útil para pré-preencher o cadastro', async () => {
    stub(AGENTES_REAIS)
    const { listarAgentes } = await import('@/lib/zaple/agentes')

    const [danilo] = await listarAgentes()

    expect(danilo.telefone).toBe('(21) 99999-8888')
  })
})
