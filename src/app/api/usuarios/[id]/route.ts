import { z } from 'zod'
import { exigirGestor } from '@/lib/auth/atual'
import { alterarUsuario } from '@/lib/auth/usuarios'

const Patch = z.object({
  ativo: z.boolean().optional(),
  papel: z.enum(['vendedor', 'gestor']).optional(),
  senha: z.string().min(8).optional(),
})

export async function PATCH(req: Request, { params }: RouteContext<'/api/usuarios/[id]'>) {
  await exigirGestor()
  const { id } = await params

  const analisado = Patch.safeParse(await req.json().catch(() => null))
  if (!analisado.success) return Response.json({ erro: 'Dados inválidos' }, { status: 400 })

  await alterarUsuario(id, analisado.data)
  return Response.json({ ok: true })
}
