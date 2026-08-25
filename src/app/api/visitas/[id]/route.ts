import { exigirUsuario } from '@/lib/auth/atual'
import { obterVisita } from '@/lib/zaple/visitas'
import { responderErroZaple } from '@/lib/api/erros'

export async function GET(_req: Request, { params }: RouteContext<'/api/visitas/[id]'>) {
  const u = await exigirUsuario()
  const { id } = await params

  try {
    const visita = await obterVisita(id)
    if (u.papel !== 'gestor' && visita.responsavelId !== u.zapleUserId) {
      return Response.json({ erro: 'Essa visita não é sua' }, { status: 403 })
    }

    return Response.json({ visita })
  } catch (erro) {
    return responderErroZaple(erro)
  }
}
