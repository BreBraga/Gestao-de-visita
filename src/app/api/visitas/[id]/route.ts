import { exigirUsuario } from '@/lib/auth/atual'
import { buscarVisita, db } from '@/lib/visita/repositorio'

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
