import { z } from 'zod'
import { exigirUsuario } from '@/lib/auth/atual'
import { buscarVisita, mudarStatus, db } from '@/lib/visita/repositorio'
import { sincronizar } from '@/lib/visita/sincronizador'

const Entrada = z.object({
  status: z.enum(['realizada', 'cancelada']),
  relatorio: z.string().max(5000).optional(),
})

export async function POST(req: Request, { params }: RouteContext<'/api/visitas/[id]/status'>) {
  const u = await exigirUsuario()
  const { id } = await params

  const analisado = Entrada.safeParse(await req.json().catch(() => null))
  if (!analisado.success) return Response.json({ erro: 'Status inválido' }, { status: 400 })

  const atual = await buscarVisita(db, id)
  if (!atual) return Response.json({ erro: 'Visita não encontrada' }, { status: 404 })
  if (u.papel !== 'gestor' && atual.usuarioId !== u.id) {
    return Response.json({ erro: 'Essa visita não é sua' }, { status: 403 })
  }

  // Visita fechada não volta atrás. Sem esta guarda, reagendar uma visita já
  // realizada apagaria o fato de ela ter acontecido e ainda criaria uma
  // segunda linha — a mesma visita contada duas vezes no dashboard.
  if (atual.status !== 'a_fazer') {
    return Response.json(
      { erro: 'Esta visita já foi fechada. Atualize a tela.' },
      { status: 409 }
    )
  }

  const alterada = await mudarStatus(db, id, analisado.data.status, analisado.data.relatorio)
  await sincronizar(db, alterada!)

  // Reler porque `sincronizar` grava `card_id` e `sincronizado_em`: devolver o
  // objeto capturado antes faria a resposta jurar que nada sincronizou.
  const atualizada = await buscarVisita(db, id)

  return Response.json({ visita: atualizada ?? alterada })
}
