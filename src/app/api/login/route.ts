import { z } from 'zod'
import { provedorSenha } from '@/lib/auth/senha'
import { criarSessao } from '@/lib/auth/sessao'
import { excedeuTentativas, registrarTentativa } from '@/lib/auth/limite'
import { normalizarTelefone } from '@/lib/zaple/contatos'

const Entrada = z.object({
  telefone: z.string().min(10),
  senha: z.string().min(1),
})

export async function POST(req: Request) {
  const analisado = Entrada.safeParse(await req.json().catch(() => null))
  if (!analisado.success) {
    return Response.json({ erro: 'Informe telefone e senha' }, { status: 400 })
  }

  // Limita por telefone alvo: sem isso, a lista de celulares da equipe vira
  // uma lista de alvos para força bruta.
  const identificador = normalizarTelefone(analisado.data.telefone)
  if (await excedeuTentativas(identificador)) {
    return Response.json(
      { erro: 'Muitas tentativas. Espere alguns minutos e tente de novo.' },
      { status: 429 }
    )
  }

  const u = await provedorSenha.confirmarLogin(analisado.data.telefone, analisado.data.senha)
  if (!u) {
    await registrarTentativa(identificador)
    // Mensagem única de propósito: dizer "esse telefone não existe" entrega
    // a lista de quem trabalha aqui para quem estiver testando.
    return Response.json({ erro: 'Telefone ou senha incorretos' }, { status: 401 })
  }

  await criarSessao(u.id)
  return Response.json({ ok: true })
}
