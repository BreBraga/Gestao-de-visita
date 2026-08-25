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

  const alterada = await mudarStatus(db, id, analisado.data.status, analisado.data.relatorio)
  await sincronizar(db, alterada!)

  return Response.json({ visita: alterada })
}
