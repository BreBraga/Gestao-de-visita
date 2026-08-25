import { describe, it, expect } from 'vitest'
import { proximaEtapa, podeMover } from '@/lib/visita/regras'
import type { Etapa } from '@/lib/zaple/tipos'

const ETAPAS: Etapa[] = [
  { id: 'e1', titulo: 'Prospecção', posicao: 1, inicial: true, final: false },
  { id: 'e2', titulo: 'Visita', posicao: 2, inicial: false, final: false },
  { id: 'e3', titulo: 'RECORRENTE', posicao: 3, inicial: false, final: false },
  { id: 'e4', titulo: 'Concluído', posicao: 4, inicial: false, final: true },
]

describe('proximaEtapa', () => {
  it('avança uma posição', () => {
    expect(proximaEtapa(ETAPAS, 'e1')?.id).toBe('e2')
    expect(proximaEtapa(ETAPAS, 'e3')?.id).toBe('e4')
  })

  it('não avança além da etapa final', () => {
    expect(proximaEtapa(ETAPAS, 'e4')).toBeNull()
  })

  it('devolve null para etapa desconhecida em vez de escolher uma qualquer', () => {
    expect(proximaEtapa(ETAPAS, 'inexistente')).toBeNull()
  })

  it('usa a posição, não a ordem em que as etapas chegaram', () => {
    const foraDeOrdem = [ETAPAS[2], ETAPAS[0], ETAPAS[3], ETAPAS[1]]
    expect(proximaEtapa(foraDeOrdem, 'e1')?.titulo).toBe('Visita')
  })
})

describe('podeMover', () => {
  it('permite ir para qualquer etapa existente, inclusive voltando', () => {
    // O vendedor reorganiza o dia à mão; travar o retrocesso só gera card preso.
    expect(podeMover(ETAPAS, 'e3', 'e1')).toBe(true)
    expect(podeMover(ETAPAS, 'e1', 'e4')).toBe(true)
  })

  it('recusa etapa que não pertence ao painel', () => {
    expect(podeMover(ETAPAS, 'e1', 'outra')).toBe(false)
  })

  it('recusa mover para a própria etapa, que só gastaria uma chamada à API', () => {
    expect(podeMover(ETAPAS, 'e2', 'e2')).toBe(false)
  })

  it('recusa quando a etapa de origem não é do painel', () => {
    expect(podeMover(ETAPAS, 'fantasma', 'e1')).toBe(false)
  })
})
