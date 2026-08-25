import { exigirGestor } from '@/lib/auth/atual'
import { listarNaoSincronizadas, db } from '@/lib/visita/repositorio'
import { sincronizar } from '@/lib/visita/sincronizador'

export async function GET() {
  await exigirGestor()
  return Response.json({ pendentes: await listarNaoSincronizadas(db) })
}

/**
 * Reprocessa a fila inteira. Sem agendador e sem backoff de propósito: com o
 * volume de hoje, um botão no admin resolve, e um processo de fundo seria
 * infraestrutura para um problema que ainda não existe.
 */
export async function POST() {
  await exigirGestor()
  const pendentes = await listarNaoSincronizadas(db)

  let sincronizadas = 0
  for (const v of pendentes) {
    const r = await sincronizar(db, v)
    if (r.ok) sincronizadas++
  }

  return Response.json({ tentadas: pendentes.length, sincronizadas })
}
