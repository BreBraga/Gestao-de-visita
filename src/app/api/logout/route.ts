import { encerrarSessao } from '@/lib/auth/sessao'

export async function POST() {
  await encerrarSessao()
  return Response.json({ ok: true })
}
