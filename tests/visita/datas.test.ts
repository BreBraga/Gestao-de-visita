import { describe, it, expect } from 'vitest'
import { hoje, formatarDia, somarDias } from '@/lib/visita/datas'

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

describe('somarDias', () => {
  it('soma e subtrai dias', () => {
    expect(somarDias('2026-08-25', 1)).toBe('2026-08-26')
    expect(somarDias('2026-08-25', -1)).toBe('2026-08-24')
  })

  it('atravessa virada de mês e de ano', () => {
    expect(somarDias('2026-08-31', 1)).toBe('2026-09-01')
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('acerta 29 de fevereiro em ano bissexto', () => {
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(somarDias('2028-03-01', -1)).toBe('2028-02-29')
  })
})
