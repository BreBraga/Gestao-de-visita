import { rotuloDoTipo } from './tipos'

/** Uma linha crua do banco: quantas visitas de um tipo um vendedor realizou. */
export type ContagemTipo = {
  tipo: string
  usuarioId: string
  total: number
}

/** Uma barra pronta para desenhar. */
export type FatiaTipo = {
  rotulo: string
  total: number
  /** Inteiro de 0 a 100. É também a largura da barra. */
  percentual: number
}

/**
 * Agrupa as contagens pelo rótulo do tipo e devolve as fatias ordenadas.
 *
 * Agrupar pelo RÓTULO, e não pelo valor do enum, é o que funde `recorrente`
 * dentro de `manutencao` sem repetir a regra aqui: `rotuloDoTipo` já devolve
 * "Manutenção" para os dois.
 *
 * Para o recorte de um vendedor, filtre as contagens por `usuarioId` antes de
 * chamar — a função não conhece o conceito de vendedor.
 */
export function fatiasPorTipo(contagens: ContagemTipo[]): FatiaTipo[] {
  const porRotulo = new Map<string, number>()

  for (const c of contagens) {
    if (c.total <= 0) continue
    const rotulo = rotuloDoTipo(c.tipo)
    porRotulo.set(rotulo, (porRotulo.get(rotulo) ?? 0) + c.total)
  }

  const total = [...porRotulo.values()].reduce((soma, n) => soma + n, 0)
  if (total === 0) return []

  return [...porRotulo.entries()]
    .map(([rotulo, n]) => ({
      rotulo,
      total: n,
      percentual: Math.round((n / total) * 100),
    }))
    // Empate desfeito pelo rótulo: sem isso a ordem depende da inserção no Map
    // e a tela reordena sozinha entre recargas.
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
}
