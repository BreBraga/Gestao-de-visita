import { z } from 'zod'
import { exigirUsuario } from '@/lib/auth/atual'
import { listarEtapas } from '@/lib/zaple/painel'
import { moverEtapa, obterVisita } from '@/lib/zaple/visitas'
import { podeMover } from '@/lib/visita/regras'
import { responderErroZaple } from '@/lib/api/erros'

const Entrada = z.object({
  etapaId: z.guid(),
  etapaAtualId: z.guid(),
})

export async function POST(req: Request, { params }: RouteContext<'/api/visitas/[id]/mover'>) {
  const u = await exigirUsuario()
  const { id } = await params

  const analisado = Entrada.safeParse(await req.json().catch(() => null))
  if (!analisado.success) return Response.json({ erro: 'Dados inválidos' }, { status: 400 })

  try {
    const [etapas, visita] = await Promise.all([listarEtapas(), obterVisita(id)])

    if (u.papel !== 'gestor' && visita.responsavelId !== u.zapleUserId) {
      return Response.json({ erro: 'Essa visita não é sua' }, { status: 403 })
    }

    if (!podeMover(etapas, visita.etapaId, analisado.data.etapaId)) {
      return Response.json({ erro: 'Etapa de destino inválida' }, { status: 400 })
    }

    // O card pode ter sido movido no Zaple enquanto a tela estava aberta.
    // Avisar é melhor do que sobrescrever em silêncio.
    if (visita.etapaId !== analisado.data.etapaAtualId) {
      return Response.json(
        { erro: `Esta visita já foi movida para "${visita.etapaTitulo ?? 'outra etapa'}". Atualize a tela.` },
        { status: 409 }
      )
    }

    const movida = await moverEtapa(id, analisado.data.etapaId)
    return Response.json({ visita: movida })
  } catch (erro) {
    return responderErroZaple(erro)
  }
}
