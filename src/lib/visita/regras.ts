import type { Etapa } from '@/lib/zaple/tipos'

export function proximaEtapa(etapas: Etapa[], atualId: string): Etapa | null {
  const ordenadas = [...etapas].sort((a, b) => a.posicao - b.posicao)
  const indice = ordenadas.findIndex((e) => e.id === atualId)
  if (indice === -1) return null
  return ordenadas[indice + 1] ?? null
}

/**
 * Qualquer etapa do painel é destino válido, inclusive para trás: o vendedor
 * reorganiza o dia à mão, e travar o retrocesso só produziria card preso.
 */
export function podeMover(etapas: Etapa[], deId: string, paraId: string): boolean {
  if (deId === paraId) return false
  return etapas.some((e) => e.id === deId) && etapas.some((e) => e.id === paraId)
}
