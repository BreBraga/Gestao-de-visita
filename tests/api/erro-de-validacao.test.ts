import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { erroDeValidacao } from '@/lib/api/erros'

const Entrada = z.object({
  titulo: z.string().min(1).max(500),
  contatoId: z.guid(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser AAAA-MM-DD'),
  tipo: z.enum(['prospeccao', 'manutencao']).optional(),
})

async function mensagemDe(corpo: unknown): Promise<{ status: number; erro: string }> {
  const analisado = Entrada.safeParse(corpo)
  if (analisado.success) throw new Error('esperava falha de validação')
  const r = erroDeValidacao(analisado.error)
  return { status: r.status, erro: (await r.json()).erro }
}

const VALIDO = {
  titulo: 'AUTOCAR',
  contatoId: 'c9b9a216-9707-4c45-acca-15fec0486051',
  data: '2026-08-26',
}

describe('erroDeValidacao', () => {
  // O caso que fez o vendedor perder tempo: ele escolheu "Pedido", o servidor
  // recusou o TIPO, e a tela disse "Informe cliente, título e data" — três
  // campos que estavam preenchidos. A mensagem mandava procurar no lugar errado.
  it('nomeia o campo recusado, e não os que estão certos', async () => {
    const { status, erro } = await mensagemDe({ ...VALIDO, tipo: 'pedido' })

    expect(status).toBe(400)
    expect(erro).toContain('Tipo da visita')
    expect(erro).not.toContain('Título')
    expect(erro).not.toContain('Cliente')
  })

  it('diz quando o campo simplesmente falta', async () => {
    const { erro } = await mensagemDe({ contatoId: VALIDO.contatoId, data: VALIDO.data })

    expect(erro).toContain('Título')
    expect(erro).toContain('não foi informado')
  })

  it('usa a mensagem que nós escrevemos, quando existe', async () => {
    const { erro } = await mensagemDe({ ...VALIDO, data: '26/08/2026' })

    expect(erro).toContain('Data da visita')
    expect(erro).toContain('AAAA-MM-DD')
  })

  it('nomeia o cliente quando o id não é um identificador válido', async () => {
    const { erro } = await mensagemDe({ ...VALIDO, contatoId: 'nao-e-uuid' })

    expect(erro).toContain('Cliente')
  })

  it('não devolve mensagem em inglês do Zod', async () => {
    const { erro } = await mensagemDe({ ...VALIDO, tipo: 'pedido' })

    expect(erro).not.toMatch(/Invalid|expected|received/i)
  })
})
