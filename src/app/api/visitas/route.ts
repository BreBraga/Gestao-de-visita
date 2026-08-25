import { z } from 'zod'
import { exigirUsuario } from '@/lib/auth/atual'
import { criarVisita, listarVisitas } from '@/lib/zaple/visitas'
import { listarEtapas } from '@/lib/zaple/painel'
import { responderErroZaple } from '@/lib/api/erros'

export async function GET(req: Request) {
  const u = await exigirUsuario()
  const url = new URL(req.url)

  // "Ver todos" é privilégio do gestor. Um vendedor que passe ?todos=1 na mão
  // continua vendo apenas as próprias visitas.
  const todos = url.searchParams.get('todos') === '1' && u.papel === 'gestor'

  try {
    const pagina = await listarVisitas({
      etapaId: url.searchParams.get('etapaId') ?? undefined,
      busca: url.searchParams.get('busca') ?? undefined,
      responsavelId: todos ? undefined : u.zapleUserId,
    })

    return Response.json(pagina)
  } catch (erro) {
    return responderErroZaple(erro)
  }
}

const NovaEntrada = z.object({
  titulo: z.string().min(1).max(500),
  contatoId: z.guid(),
  prazo: z.iso.datetime().optional(),
  responsavelId: z.guid().optional(),
})

export async function POST(req: Request) {
  const u = await exigirUsuario()

  const analisado = NovaEntrada.safeParse(await req.json().catch(() => null))
  if (!analisado.success) {
    return Response.json({ erro: 'Informe título e cliente' }, { status: 400 })
  }

  try {
    const etapas = await listarEtapas()
    const inicial = etapas.find((e) => e.inicial)
    if (!inicial) return Response.json({ erro: 'Painel sem etapa inicial' }, { status: 500 })

    // Só o gestor atribui visita a outra pessoa.
    const responsavelId =
      u.papel === 'gestor' && analisado.data.responsavelId
        ? analisado.data.responsavelId
        : u.zapleUserId

    const visita = await criarVisita({
      etapaId: inicial.id,
      titulo: analisado.data.titulo,
      responsavelId,
      contatoIds: [analisado.data.contatoId],
      prazo: analisado.data.prazo,
    })

    return Response.json({ visita }, { status: 201 })
  } catch (erro) {
    return responderErroZaple(erro)
  }
}
