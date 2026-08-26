import { z } from 'zod'
import { exigirGestor } from '@/lib/auth/atual'
import { alterarUsuario, listarUsuarios } from '@/lib/auth/usuarios'
import { listarAgentes } from '@/lib/zaple/agentes'
import { responderErroZaple, erroDeValidacao } from '@/lib/api/erros'

const Patch = z.object({
  nome: z.string().trim().min(2).optional(),
  telefone: z.string().trim().min(10).optional(),
  email: z.email().nullable().optional(),
  zapleUserId: z.guid().optional(),
  ativo: z.boolean().optional(),
  papel: z.enum(['vendedor', 'gestor']).optional(),
  senha: z.string().min(8).optional(),
})

export async function PATCH(req: Request, { params }: RouteContext<'/api/usuarios/[id]'>) {
  const gestor = await exigirGestor()
  const { id } = await params

  const analisado = Patch.safeParse(await req.json().catch(() => null))
  if (!analisado.success) return erroDeValidacao(analisado.error)

  // Um gestor que se rebaixa ou se desativa perde o acesso a esta tela — e se
  // for o último, ninguém mais consegue cadastrar pessoas. É o problema do
  // ovo e da galinha do admin, agora pelo avesso.
  const seRebaixando = analisado.data.papel === 'vendedor' || analisado.data.ativo === false
  if (id === gestor.id && seRebaixando) {
    return Response.json(
      { erro: 'Você não pode remover o próprio acesso de gestor.' },
      { status: 409 }
    )
  }

  if (analisado.data.papel === 'vendedor' || analisado.data.ativo === false) {
    const usuarios = await listarUsuarios()
    const outrosGestores = usuarios.filter(
      (u) => u.papel === 'gestor' && u.ativo && u.id !== id
    )
    if (outrosGestores.length === 0) {
      return Response.json(
        { erro: 'Este é o último gestor ativo. Promova outra pessoa antes.' },
        { status: 409 }
      )
    }
  }

  try {
    // O vínculo com o Zaple é validado como na criação: apontar para um id
    // que não existe lá deixa o vendedor sem enxergar visita nenhuma, e o
    // sintoma só aparece dias depois, em campo.
    if (analisado.data.zapleUserId) {
      const agentes = await listarAgentes()
      if (!agentes.some((a) => a.userId === analisado.data.zapleUserId)) {
        return Response.json({ erro: 'Esse agente não existe no Zaple' }, { status: 400 })
      }
    }

    await alterarUsuario(id, analisado.data)
    return Response.json({ ok: true })
  } catch (erro) {
    if ((erro as { code?: string }).code === '23505') {
      return Response.json({ erro: 'Já existe usuário com esse telefone' }, { status: 409 })
    }
    return responderErroZaple(erro)
  }
}
