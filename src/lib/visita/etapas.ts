import type { Etapa } from '@/lib/zaple/tipos'

/**
 * Nomes aceitos por status, em ordem de preferência. O primeiro é o nome novo
 * que o painel vai ter; os seguintes são os apelidos do painel de teste, que
 * ainda está no ar. Sem isto, o sincronismo pararia no dia da renomeação — ou
 * antes dela.
 */
const NOMES: Record<string, string[]> = {
  a_fazer: ['a fazer', 'prospeccao', 'prospecção'],
  realizada: ['realizada', 'concluido', 'concluído'],
  cancelada: ['cancelada'],
  reagendada: ['reagendada', 'recorrente'],
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Casa um status nosso com uma etapa do painel pelo nome.
 *
 * Devolve null de propósito quando não há correspondência: o painel é
 * configurado por gente, fora do nosso controle, e uma etapa pode
 * simplesmente não existir. Quem chama decide o que fazer — e a resposta
 * certa nunca é impedir o vendedor de trabalhar.
 */
export function etapaParaStatus(etapas: Etapa[], status: string): Etapa | null {
  const aceitos = NOMES[status]
  if (!aceitos) return null

  for (const nome of aceitos) {
    const achada = etapas.find((e) => normalizar(e.titulo) === normalizar(nome))
    if (achada) return achada
  }
  return null
}
