import { describe, it, expect } from 'vitest'
import { hoje, formatarDia } from '@/lib/visita/datas'

describe('formatarDia', () => {
  it('converte YYYY-MM-DD para DD/MM/AAAA sem passar por Date', () => {
    expect(formatarDia('2026-08-25')).toBe('25/08/2026')
  })
})

describe('hoje', () => {
  it('devolve a data no formato AAAA-MM-DD', () => {
    expect(hoje()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
