import { z } from 'zod'
import { exigirGestor } from '@/lib/auth/atual'
import { criarUsuario, listarUsuarios } from '@/lib/auth/usuarios'
import { listarAgentes } from '@/lib/zaple/agentes'
import { responderErroZaple } from '@/lib/api/erros'

const Entrada = z.object({
  nome: z.string().min(2),
  telefone: z.string().min(10),
  email: z.email().nullable().optional(),
  senha: z.string().min(8),
  zapleUserId: z.guid(),
  papel: z.enum(['vendedor', 'gestor']),
})

export async function GET() {
  await exigirGestor()

  try {
    const [usuarios, agentes] = await Promise.all([listarUsuarios(), listarAgentes()])

    return Response.json({
      // O hash nunca sai daqui, nem para o gestor.
      usuarios: usuarios.map(({ senhaHash: _ignorado, ...resto }) => resto),
      agentes,
    })
  } catch (erro) {
    return responderErroZaple(erro)
  }
}

export async function POST(req: Request) {
  await exigirGestor()

  const analisado = Entrada.safeParse(await req.json().catch(() => null))
  if (!analisado.success) {
    return Response.json(
      { erro: 'Dados inválidos: ' + analisado.error.issues[0].message },
      { status: 400 }
    )
  }

  // Compara com o userId do agente, não com o id: é o userId que aparece em
  // responsibleUserId nos cards. Vincular ao id errado produz um vendedor que
  // nunca enxerga visita nenhuma, e o sintoma só aparece dias depois, em campo.
  try {
    const agentes = await listarAgentes()
    if (!agentes.some((a) => a.userId === analisado.data.zapleUserId)) {
      return Response.json({ erro: 'Esse agente não existe no Zaple' }, { status: 400 })
    }

    const criado = await criarUsuario(analisado.data)
    return Response.json({ id: criado.id }, { status: 201 })
  } catch (erro) {
    if ((erro as { code?: string }).code === '23505') {
      return Response.json({ erro: 'Já existe usuário com esse telefone' }, { status: 409 })
    }
    // Relança o que não for do Zaple, como o `throw erro` fazia antes.
    return responderErroZaple(erro)
  }
}
