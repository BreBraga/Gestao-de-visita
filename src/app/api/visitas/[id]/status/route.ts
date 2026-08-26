import { z } from 'zod'
import { exigirUsuario } from '@/lib/auth/atual'
import {
  buscarVisita,
  mudarStatus,
  reabrirVisita,
  realizarComRetorno,
  db,
} from '@/lib/visita/repositorio'
import { sincronizar } from '@/lib/visita/sincronizador'
import { erroDeValidacao } from '@/lib/api/erros'

const DataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser AAAA-MM-DD')

const Entrada = z.object({
  status: z.enum(['realizada', 'cancelada', 'a_fazer']),
  /** Exigido ao realizar: é o registro do que foi tratado com o cliente. */
  relatorio: z.string().trim().min(1).max(5000).optional(),
  /** Opcional ao realizar: já deixa a próxima visita agendada. */
  proximaVisita: z
    .object({ data: DataISO, descricao: z.string().trim().max(1000).optional() })
    .optional(),
})

export async function POST(req: Request, { params }: RouteContext<'/api/visitas/[id]/status'>) {
  const u = await exigirUsuario()
  const { id } = await params

  const analisado = Entrada.safeParse(await req.json().catch(() => null))
  if (!analisado.success) return erroDeValidacao(analisado.error)

  const atual = await buscarVisita(db, id)
  if (!atual) return Response.json({ erro: 'Visita não encontrada' }, { status: 404 })
  if (u.papel !== 'gestor' && atual.usuarioId !== u.id) {
    return Response.json({ erro: 'Essa visita não é sua' }, { status: 403 })
  }

  const destino = analisado.data.status

  // Reabrir: traz de volta o que foi fechado por engano. Uma visita
  // `reagendada` fica fora porque a substituta dela já existe — reabrir as
  // duas deixaria o mesmo cliente agendado em dois dias.
  if (destino === 'a_fazer') {
    if (atual.status === 'a_fazer') {
      return Response.json({ erro: 'Esta visita já está aberta.' }, { status: 409 })
    }
    if (atual.status === 'reagendada') {
      return Response.json(
        { erro: 'Esta visita foi reagendada. Abra a visita nova para mexer nela.' },
        { status: 409 }
      )
    }
    const reaberta = await reabrirVisita(db, id)
    await sincronizar(db, reaberta!)
    return Response.json({ visita: await buscarVisita(db, id) })
  }

  if (atual.status !== 'a_fazer') {
    return Response.json({ erro: 'Esta visita já foi fechada. Atualize a tela.' }, { status: 409 })
  }

  if (destino === 'cancelada') {
    const alterada = await mudarStatus(db, id, 'cancelada')
    await sincronizar(db, alterada!)
    return Response.json({ visita: (await buscarVisita(db, id)) ?? alterada })
  }

  // Realizada exige o relato: uma visita sem registro do que foi tratado é
  // uma linha no relatório que não ajuda ninguém a decidir nada depois.
  if (!analisado.data.relatorio) {
    return Response.json({ erro: 'Descreva o que foi tratado com o cliente' }, { status: 400 })
  }

  const r = await realizarComRetorno(
    db,
    id,
    analisado.data.relatorio,
    analisado.data.proximaVisita
  )

  await sincronizar(db, r!.realizada)
  if (r!.proxima) await sincronizar(db, r!.proxima)

  return Response.json({
    visita: (await buscarVisita(db, id)) ?? r!.realizada,
    proxima: r!.proxima,
  })
}
