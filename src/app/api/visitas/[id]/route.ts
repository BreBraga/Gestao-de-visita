import { z } from 'zod'
import { exigirUsuario } from '@/lib/auth/atual'
import { buscarVisita, editarVisita, db } from '@/lib/visita/repositorio'
import { sincronizar } from '@/lib/visita/sincronizador'
import { VALORES_TIPO } from '@/lib/visita/tipos'

export async function GET(_req: Request, { params }: RouteContext<'/api/visitas/[id]'>) {
  const u = await exigirUsuario()
  const { id } = await params

  const visita = await buscarVisita(db, id)
  if (!visita) return Response.json({ erro: 'Visita não encontrada' }, { status: 404 })

  if (u.papel !== 'gestor' && visita.usuarioId !== u.id) {
    return Response.json({ erro: 'Essa visita não é sua' }, { status: 403 })
  }

  return Response.json({ visita })
}

const Edicao = z.object({
  titulo: z.string().trim().min(1).max(500).optional(),
  descricao: z.string().trim().max(2000).nullable().optional(),
  tipo: z.enum(VALORES_TIPO).optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser AAAA-MM-DD').optional(),
})

export async function PATCH(req: Request, { params }: RouteContext<'/api/visitas/[id]'>) {
  const u = await exigirUsuario()
  const { id } = await params

  const analisado = Edicao.safeParse(await req.json().catch(() => null))
  if (!analisado.success) return Response.json({ erro: 'Dados inválidos' }, { status: 400 })

  const atual = await buscarVisita(db, id)
  if (!atual) return Response.json({ erro: 'Visita não encontrada' }, { status: 404 })
  if (u.papel !== 'gestor' && atual.usuarioId !== u.id) {
    return Response.json({ erro: 'Essa visita não é sua' }, { status: 403 })
  }

  // Trocar a data de uma visita fechada reescreveria o histórico: ela
  // aconteceu no dia em que aconteceu. Corrigir data pede reabrir antes.
  if (analisado.data.data && atual.status !== 'a_fazer') {
    return Response.json(
      { erro: 'Para mudar a data, reabra a visita antes.' },
      { status: 409 }
    )
  }

  const alterada = await editarVisita(db, id, analisado.data)
  await sincronizar(db, alterada!)

  return Response.json({ visita: (await buscarVisita(db, id)) ?? alterada })
}
