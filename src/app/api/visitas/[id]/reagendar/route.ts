import { z } from 'zod'
import { exigirUsuario } from '@/lib/auth/atual'
import { buscarVisita, reagendar, db } from '@/lib/visita/repositorio'
import { sincronizar } from '@/lib/visita/sincronizador'

const Entrada = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser AAAA-MM-DD'),
})

export async function POST(req: Request, { params }: RouteContext<'/api/visitas/[id]/reagendar'>) {
  const u = await exigirUsuario()
  const { id } = await params

  const analisado = Entrada.safeParse(await req.json().catch(() => null))
  if (!analisado.success) return Response.json({ erro: 'Informe a nova data' }, { status: 400 })

  const atual = await buscarVisita(db, id)
  if (!atual) return Response.json({ erro: 'Visita não encontrada' }, { status: 404 })
  if (u.papel !== 'gestor' && atual.usuarioId !== u.id) {
    return Response.json({ erro: 'Essa visita não é sua' }, { status: 403 })
  }

  const r = await reagendar(db, id, analisado.data.data)
  await sincronizar(db, r!.fechada)
  await sincronizar(db, r!.nova)

  return Response.json({ visita: r!.nova }, { status: 201 })
}
