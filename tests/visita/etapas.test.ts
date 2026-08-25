import { describe, it, expect } from 'vitest'
import { etapaParaStatus } from '@/lib/visita/etapas'
import type { Etapa } from '@/lib/zaple/tipos'

function etapa(id: string, titulo: string, posicao: number): Etapa {
  return { id, titulo, posicao, inicial: posicao === 1, final: false }
}

const PAINEL_NOVO = [
  etapa('e1', 'A fazer', 1),
  etapa('e2', 'Realizada', 2),
  etapa('e3', 'Cancelada', 3),
  etapa('e4', 'Reagendada', 4),
]

const PAINEL_ANTIGO = [
  etapa('a1', 'Prospecção', 1),
  etapa('a2', 'Visita', 2),
  etapa('a3', 'RECORRENTE', 3),
  etapa('a4', 'Concluído', 4),
]

describe('etapaParaStatus', () => {
  it('acha a etapa pelo nome no painel já renomeado', () => {
    expect(etapaParaStatus(PAINEL_NOVO, 'realizada')?.id).toBe('e2')
    expect(etapaParaStatus(PAINEL_NOVO, 'a_fazer')?.id).toBe('e1')
    expect(etapaParaStatus(PAINEL_NOVO, 'cancelada')?.id).toBe('e3')
    expect(etapaParaStatus(PAINEL_NOVO, 'reagendada')?.id).toBe('e4')
  })

  it('ignora caixa e acento, porque o nome é digitado por gente', () => {
    const painel = [etapa('x', 'REALIZADA', 1)]

    expect(etapaParaStatus(painel, 'realizada')?.id).toBe('x')
  })

  it('cai no apelido antigo enquanto o painel não for renomeado', () => {
    // 'Concluído' é o nome antigo de 'Realizada'.
    expect(etapaParaStatus(PAINEL_ANTIGO, 'realizada')?.id).toBe('a4')
    expect(etapaParaStatus(PAINEL_ANTIGO, 'a_fazer')?.id).toBe('a1')
  })

  it('devolve null quando não existe etapa correspondente', () => {
    expect(etapaParaStatus(PAINEL_ANTIGO, 'cancelada')).toBeNull()
  })
})
