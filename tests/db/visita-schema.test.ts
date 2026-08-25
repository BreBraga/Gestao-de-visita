import { describe, it, expect } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { visita } from '@/lib/db/schema'

describe('tabela visita', () => {
  const config = getTableConfig(visita)
  const colunas = Object.fromEntries(config.columns.map((c) => [c.name, c]))

  it('tem as colunas que a agenda e o dashboard precisam', () => {
    for (const nome of [
      'id',
      'contato_id',
      'contato_nome',
      'usuario_id',
      'zaple_user_id',
      'data',
      'status',
      'tipo',
      'titulo',
      'relatorio',
      'origem_id',
      'card_id',
      'sincronizado_em',
      'criada_em',
      'atualizada_em',
    ]) {
      expect(colunas[nome], `faltou a coluna ${nome}`).toBeDefined()
    }
  })

  it('congela o nome do cliente para o dashboard não consultar o Zaple por linha', () => {
    expect(colunas['contato_nome'].notNull).toBe(true)
  })

  it('exige o vínculo com o agente do Zaple, como a tabela usuario', () => {
    expect(colunas['zaple_user_id'].notNull).toBe(true)
  })

  it('nasce a fazer', () => {
    expect(colunas['status'].hasDefault).toBe(true)
  })

  it('deixa nulo o que só existe depois — relatório, card e sincronismo', () => {
    expect(colunas['relatorio'].notNull).toBe(false)
    expect(colunas['card_id'].notNull).toBe(false)
    expect(colunas['sincronizado_em'].notNull).toBe(false)
    expect(colunas['origem_id'].notNull).toBe(false)
  })

  it('não tem coluna de coordenada — sem endereço do cliente o GPS não significa nada', () => {
    expect(Object.keys(colunas)).not.toContain('latitude')
    expect(Object.keys(colunas)).not.toContain('longitude')
  })
})
