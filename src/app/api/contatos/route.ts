import { z } from 'zod'
import { exigirUsuario } from '@/lib/auth/atual'
import { buscarContatoPorTelefone, buscarContatosPorNome, criarContato } from '@/lib/zaple/contatos'
import { responderErroZaple, erroDeValidacao } from '@/lib/api/erros'

export async function GET(req: Request) {
  await exigirUsuario()
  const busca = new URL(req.url).searchParams.get('busca')?.trim() ?? ''
  if (busca.length < 2) return Response.json({ contatos: [] })

  // Se o que foi digitado parece um telefone, a busca exata é mais útil e
  // mais barata do que varrer nomes.
  const soDigitos = busca.replace(/\D/g, '')

  try {
    if (soDigitos.length >= 10) {
      const achado = await buscarContatoPorTelefone(soDigitos)
      return Response.json({ contatos: achado ? [achado] : [] })
    }

    return Response.json({ contatos: await buscarContatosPorNome(busca) })
  } catch (erro) {
    return responderErroZaple(erro)
  }
}

const NovoContato = z.object({
  nome: z.string().min(2),
  telefone: z.string().min(10),
})

export async function POST(req: Request) {
  await exigirUsuario()

  const analisado = NovoContato.safeParse(await req.json().catch(() => null))
  if (!analisado.success) return erroDeValidacao(analisado.error)

  try {
    // Criar duplicata de um cliente que já existe suja a base do CRM inteiro,
    // então a checagem vem antes.
    const jaExiste = await buscarContatoPorTelefone(analisado.data.telefone)
    if (jaExiste) return Response.json({ contato: jaExiste }, { status: 200 })

    return Response.json({ contato: await criarContato(analisado.data) }, { status: 201 })
  } catch (erro) {
    return responderErroZaple(erro)
  }
}
