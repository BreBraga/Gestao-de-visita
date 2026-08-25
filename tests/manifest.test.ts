import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('manifest do PWA', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf-8'))

  it('declara nome e ponto de partida', () => {
    expect(manifest.name).toBe('Gestão de Visitas')
    expect(manifest.short_name).toBe('Visitas')
    expect(manifest.start_url).toBe('/')
  })

  it('abre como aplicativo, não como aba de navegador', () => {
    expect(manifest.display).toBe('standalone')
  })

  it('tem os dois tamanhos de ícone que o Android exige', () => {
    const tamanhos = manifest.icons.map((i: { sizes: string }) => i.sizes)
    expect(tamanhos).toContain('192x192')
    expect(tamanhos).toContain('512x512')
  })
})
