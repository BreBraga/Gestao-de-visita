/**
 * Os tipos de visita, num lugar só.
 *
 * Esta lista já esteve copiada em cinco arquivos — as duas rotas, os dois
 * formulários e a tela de detalhe. Quando os tipos novos chegaram, uma das
 * cópias ficou para trás, e escolher "Manutenção" na tela devolvia 400 em
 * produção sem que nenhum teste acusasse: cada lado estava certo sozinho.
 *
 * `recorrente` não aparece aqui de propósito. É o nome antigo de `manutencao`
 * e continua no enum do banco porque as linhas antigas o usam, mas ninguém
 * deve poder escolhê-lo de novo.
 */
export const TIPOS_VISITA = [
  { valor: 'prospeccao', rotulo: 'Prospecção', ajuda: 'Cliente novo' },
  { valor: 'manutencao', rotulo: 'Manutenção', ajuda: 'Cliente da carteira' },
  { valor: 'pedido', rotulo: 'Pedido', ajuda: 'Fechar compra' },
  { valor: 'entrega', rotulo: 'Entrega', ajuda: 'Levar mercadoria' },
  { valor: 'outro', rotulo: 'Outro', ajuda: 'Descreva abaixo' },
] as const

export type TipoEscolhivel = (typeof TIPOS_VISITA)[number]['valor']

/** Para os schemas Zod, que precisam de uma tupla de literais. */
export const VALORES_TIPO = TIPOS_VISITA.map((t) => t.valor) as unknown as [
  TipoEscolhivel,
  ...TipoEscolhivel[],
]

/** Rótulo legível, incluindo o `recorrente` herdado das linhas antigas. */
export function rotuloDoTipo(tipo: string): string {
  if (tipo === 'recorrente') return 'Manutenção'
  return TIPOS_VISITA.find((t) => t.valor === tipo)?.rotulo ?? tipo
}
