import { z } from 'zod'
import { exigirUsuario } from '@/lib/auth/atual'
import { criarVisita, listarDoDia, buscarVisita, db } from '@/lib/visita/repositorio'
import { sincronizar } from '@/lib/visita/sincronizador'
import { VALORES_TIPO } from '@/lib/visita/tipos'
import { hoje } from '@/lib/visita/datas'

/** 'YYYY-MM-DD'. String, não Date: o fuso não pode mover a visita de dia. */
const DataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser AAAA-MM-DD')

export async function GET(req: Request) {
  const u = await exigirUsuario()
  const url = new URL(req.url)

  const bruta = url.searchParams.get('data')
  const analisadaData = bruta ? DataISO.safeParse(bruta) : null
  if (bruta && !analisadaData!.success) {
    return Response.json({ erro: 'Data deve ser AAAA-MM-DD' }, { status: 400 })
  }
  const data = bruta ?? hoje()
  const todos = url.searchParams.get('todos') === '1' && u.papel === 'gestor'

  const visitas = await listarDoDia(db, { data, usuarioId: todos ? undefined : u.id })
  return Response.json({ visitas })
}

const NovaEntrada = z.object({
  titulo: z.string().min(1).max(500),
  contatoId: z.guid(),
  contatoNome: z.string().min(1),
  data: DataISO,
  tipo: z.enum(VALORES_TIPO).optional(),
  descricao: z.string().trim().max(2000).optional(),
  usuarioId: z.uuid().optional(),
  zapleUserId: z.guid().optional(),
})

export async function POST(req: Request) {
  const u = await exigirUsuario()

  const analisado = NovaEntrada.safeParse(await req.json().catch(() => null))
  if (!analisado.success) {
    return Response.json({ erro: 'Informe cliente, título e data' }, { status: 400 })
  }

  // Um dos dois sem o outro é ambíguo: decidir por conta própria criaria a
  // visita no nome errado sem ninguém perceber.
  const { usuarioId, zapleUserId } = analisado.data
  if ((usuarioId && !zapleUserId) || (!usuarioId && zapleUserId)) {
    return Response.json(
      { erro: 'Para atribuir a outro vendedor, informe usuarioId e zapleUserId juntos' },
      { status: 400 }
    )
  }

  // Só o gestor cria visita para outra pessoa.
  const paraOutro = u.papel === 'gestor' && analisado.data.usuarioId && analisado.data.zapleUserId

  const criada = await criarVisita(db, {
    contatoId: analisado.data.contatoId,
    contatoNome: analisado.data.contatoNome,
    usuarioId: paraOutro ? analisado.data.usuarioId! : u.id,
    zapleUserId: paraOutro ? analisado.data.zapleUserId! : u.zapleUserId,
    data: analisado.data.data,
    titulo: analisado.data.titulo,
    tipo: analisado.data.tipo,
    descricao: analisado.data.descricao,
  })

  // A visita já existe. O Zaple é cópia: se falhar, `sincronizado_em` fica
  // nulo e o admin reprocessa. O vendedor não fica sabendo, porque para ele
  // não houve erro nenhum.
  await sincronizar(db, criada)

  // Reler porque `sincronizar` grava `card_id` e `sincronizado_em`: devolver o
  // objeto capturado antes faria a resposta jurar que nada sincronizou.
  const atualizada = await buscarVisita(db, criada.id)

  return Response.json({ visita: atualizada ?? criada }, { status: 201 })
}
