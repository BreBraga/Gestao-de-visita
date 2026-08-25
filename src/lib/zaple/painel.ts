import { zapleGet } from './client'
import type { Etapa } from './tipos'

type EtapaApi = {
  id: string
  title: string
  position: number
  isInitial: boolean
  isFinal: boolean
}

type PainelApi = {
  id: string
  title: string
  steps: EtapaApi[] | null
}

type PaginaPaineisApi = {
  items: PainelApi[]
}

export function painelId(): string {
  const id = process.env.ZAPLE_PANEL_ID
  if (!id) throw new Error('ZAPLE_PANEL_ID não configurado')
  return id
}

function paraEtapas(brutas: EtapaApi[]): Etapa[] {
  return brutas
    .map((e) => ({
      id: e.id,
      titulo: e.title,
      posicao: e.position,
      inicial: e.isInitial,
      final: e.isFinal,
    }))
    .sort((a, b) => a.posicao - b.posicao)
}

/**
 * As etapas vêm da listagem v2, não do detalhe v1.
 *
 * Verificado contra a API de produção em 2026-08-24: `GET /crm/v1/panel/{id}`
 * devolve `steps: null` mesmo com o painel tendo quatro etapas, enquanto
 * `GET /crm/v2/panel?IncludeDetails=Steps` devolve todas preenchidas. A
 * documentação não menciona a diferença — só o teste ao vivo revelou.
 */
export async function listarEtapas(): Promise<Etapa[]> {
  const id = painelId()

  const pagina = await zapleGet<PaginaPaineisApi>('/crm/v2/panel', {
    IncludeDetails: 'Steps',
    PageSize: 100,
  })

  const painel = pagina.items.find((p) => p.id === id)
  if (!painel) {
    throw new Error(`Painel ${id} não encontrado — confira ZAPLE_PANEL_ID e o escopo do token`)
  }

  return paraEtapas(painel.steps ?? [])
}
