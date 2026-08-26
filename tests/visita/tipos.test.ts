import { describe, it, expect } from 'vitest'
import { TIPOS_VISITA, VALORES_TIPO, rotuloDoTipo } from '@/lib/visita/tipos'

describe('rotuloDoTipo', () => {
  // O card da agenda decidia o rótulo na mão: qualquer tipo que não fosse
  // `recorrente` aparecia como "Prospecção". O vendedor escolhia Entrega, o
  // banco gravava entrega, e a tela dizia Prospecção — o dado certo,
  // exibido errado, que é o defeito mais difícil de acreditar.
  it('devolve o rótulo certo para cada tipo, sem cair em Prospecção', () => {
    expect(rotuloDoTipo('prospeccao')).toBe('Prospecção')
    expect(rotuloDoTipo('manutencao')).toBe('Manutenção')
    expect(rotuloDoTipo('pedido')).toBe('Pedido')
    expect(rotuloDoTipo('entrega')).toBe('Entrega')
    expect(rotuloDoTipo('outro')).toBe('Outro')
  })

  it('nenhum tipo, exceto prospeccao, vira Prospecção', () => {
    for (const t of VALORES_TIPO.filter((v) => v !== 'prospeccao')) {
      expect(rotuloDoTipo(t), `${t} apareceu como Prospecção`).not.toBe('Prospecção')
    }
  })

  it('traduz o `recorrente` herdado das linhas antigas', () => {
    expect(rotuloDoTipo('recorrente')).toBe('Manutenção')
  })

  it('não inventa rótulo para valor desconhecido', () => {
    expect(rotuloDoTipo('inexistente')).toBe('inexistente')
  })

  it('a lista da tela e a lista aceita pela API são a mesma', () => {
    expect(VALORES_TIPO).toEqual(TIPOS_VISITA.map((t) => t.valor))
    expect(VALORES_TIPO).toHaveLength(5)
  })
})
