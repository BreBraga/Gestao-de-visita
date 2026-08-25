import { describe, it, expect } from 'vitest'
import { erroDaResposta } from '@/lib/api/cliente'

describe('erroDaResposta', () => {
  it('usa a mensagem que a API mandou', async () => {
    const r = Response.json({ erro: 'Essa visita não é sua' }, { status: 403 })

    expect(await erroDaResposta(r, 'padrão')).toBe('Essa visita não é sua')
  })

  // O caso que fazia a tela mentir: 500 de corpo vazio virava exceção no
  // parse, caía no catch de rede e aparecia como "Sem conexão".
  it('cai no padrão quando o corpo está vazio, sem lançar', async () => {
    const r = new Response('', { status: 500 })

    expect(await erroDaResposta(r, 'Não foi possível criar a visita')).toBe(
      'Não foi possível criar a visita'
    )
  })

  it('cai no padrão quando o corpo é HTML', async () => {
    const r = new Response('<!DOCTYPE html><h1>502 Bad Gateway</h1>', { status: 502 })

    expect(await erroDaResposta(r, 'padrão')).toBe('padrão')
  })

  it('cai no padrão quando o JSON não tem o campo erro', async () => {
    const r = Response.json({ mensagem: 'outro formato' }, { status: 400 })

    expect(await erroDaResposta(r, 'padrão')).toBe('padrão')
  })
})
