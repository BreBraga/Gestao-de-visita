import { describe, it, expect } from 'vitest'
import { fatiasPorTipo, type ContagemTipo } from '@/lib/visita/painel-tipos'

const U1 = 'aaaaaaaa-0000-0000-0000-000000000001'
const U2 = 'aaaaaaaa-0000-0000-0000-000000000002'

function c(tipo: string, total: number, usuarioId = U1): ContagemTipo {
  return { tipo, usuarioId, total }
}

describe('fatiasPorTipo', () => {
  it('soma as contagens e calcula o percentual sobre o total', () => {
    const fatias = fatiasPorTipo([c('prospeccao', 6), c('pedido', 4)])

    expect(fatias).toEqual([
      { rotulo: 'Prospecção', total: 6, percentual: 60 },
      { rotulo: 'Pedido', total: 4, percentual: 40 },
    ])
  })

  it('soma linhas do mesmo tipo vindas de vendedores diferentes', () => {
    const fatias = fatiasPorTipo([c('pedido', 3, U1), c('pedido', 2, U2)])

    expect(fatias).toEqual([{ rotulo: 'Pedido', total: 5, percentual: 100 }])
  })

  it('funde recorrente dentro de manutenção', () => {
    // `recorrente` é o nome antigo do mesmo tipo e ainda existe em linhas
    // gravadas. Sem a fusão, "Manutenção" apareceria duas vezes no gráfico.
    const fatias = fatiasPorTipo([c('manutencao', 3), c('recorrente', 2)])

    expect(fatias).toEqual([{ rotulo: 'Manutenção', total: 5, percentual: 100 }])
  })

  it('ordena da maior fatia para a menor', () => {
    const fatias = fatiasPorTipo([c('outro', 1), c('prospeccao', 9), c('entrega', 5)])

    expect(fatias.map((f) => f.rotulo)).toEqual(['Prospecção', 'Entrega', 'Outro'])
  })

  it('desempata pelo rótulo, para a tela não pular entre recargas', () => {
    const fatias = fatiasPorTipo([c('pedido', 4), c('entrega', 4), c('outro', 4)])

    expect(fatias.map((f) => f.rotulo)).toEqual(['Entrega', 'Outro', 'Pedido'])
  })

  it('omite tipos sem visita em vez de mostrar barra zerada', () => {
    const fatias = fatiasPorTipo([c('prospeccao', 3), c('entrega', 0)])

    expect(fatias.map((f) => f.rotulo)).toEqual(['Prospecção'])
  })

  it('devolve lista vazia quando não há nada no período', () => {
    expect(fatiasPorTipo([])).toEqual([])
  })

  it('não divide por zero quando todas as contagens são zero', () => {
    expect(fatiasPorTipo([c('prospeccao', 0)])).toEqual([])
  })

  it('arredonda o percentual, aceitando que a soma não dê exatamente 100', () => {
    // Três fatias iguais dão 33% cada e somam 99. O percentual é exibido por
    // fatia, sem total na tela, então ninguém confronta a soma — mas o teste
    // fixa o comportamento para que ninguém "conserte" isso distribuindo sobra.
    const fatias = fatiasPorTipo([c('pedido', 1), c('entrega', 1), c('outro', 1)])

    expect(fatias.map((f) => f.percentual)).toEqual([33, 33, 33])
  })
})
