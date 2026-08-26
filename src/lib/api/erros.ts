import { ZapleError } from '@/lib/zaple/erros'

/**
 * Traduz a recusa do Zaple em resposta JSON.
 *
 * Sem isto o ZapleError sobe até o Next, que responde 500 com corpo vazio. O
 * cliente então tenta ler `(await r.json()).erro`, o parse estoura no corpo
 * vazio, a exceção cai no catch que existe para falha de rede — e uma recusa
 * clara da API ("O responsável informado não foi encontrado") aparece na tela
 * como "Sem conexão". O diagnóstico do erro se perde inteiro no caminho.
 *
 * O que não é ZapleError é relançado de propósito: bug de programação deve
 * continuar virando 500 no log, e o `redirect()` de `exigirUsuario()` funciona
 * lançando uma exceção que o Next precisa receber de volta.
 */
export function responderErroZaple(erro: unknown): Response {
  if (!(erro instanceof ZapleError)) throw erro

  // A mensagem de permissão é do token do servidor, não de algo que o vendedor
  // possa resolver na tela — por isso não repassamos o texto cru do Zaple.
  if (erro.autorizacao) {
    return Response.json(
      { erro: 'O token do Zaple não tem permissão para esta operação.' },
      { status: 502 }
    )
  }

  // 502 no resto porque a falha é do outro lado, não do que foi digitado aqui.
  return Response.json({ erro: erro.message }, { status: erro.naoEncontrado ? 404 : 502 })
}

/**
 * Nome de cada campo como o vendedor o conhece na tela.
 *
 * A tela chama de "Tipo da visita"; o corpo da requisição chama de `tipo`.
 * Uma mensagem de erro que devolve o nome do campo do código manda a pessoa
 * procurar algo que ela nunca viu.
 */
const ROTULOS: Record<string, string> = {
  titulo: 'Título da visita',
  contatoId: 'Cliente',
  contatoNome: 'Cliente',
  data: 'Data da visita',
  tipo: 'Tipo da visita',
  descricao: 'Motivo da visita',
  status: 'Status',
  relatorio: 'Relato da visita',
  proximaVisita: 'Próxima visita',
  usuarioId: 'Vendedor',
  zapleUserId: 'Agente no Zaple',
  nome: 'Nome',
  telefone: 'Telefone',
  email: 'E-mail',
  senha: 'Senha',
  papel: 'Papel',
  ativo: 'Situação',
}

/** Uma mensagem é nossa quando não parece o texto padrão do Zod, que é inglês. */
function ehMensagemNossa(mensagem: string): boolean {
  return !/^Invalid|expected|received|Too (small|big)/i.test(mensagem)
}

/**
 * Transforma a recusa de validação numa frase que diz O QUE recusou.
 *
 * Antes, toda falha virava a mesma mensagem genérica — "Informe cliente,
 * título e data". Quando o servidor recusou o TIPO da visita, a tela mandou o
 * vendedor conferir três campos que estavam preenchidos, e o defeito real
 * ficou escondido até alguém ler o código. Uma mensagem que nomeia o campo
 * faz o erro se explicar sozinho.
 */
export function erroDeValidacao(erro: { issues: readonly ZodIssue[] }): Response {
  const problema = erro.issues[0]
  if (!problema) return Response.json({ erro: 'Dados inválidos' }, { status: 400 })

  const chave = String(problema.path[0] ?? '')
  const campo = ROTULOS[chave] ?? chave

  let detalhe: string
  if (problema.code === 'invalid_type' && /received undefined/i.test(problema.message)) {
    detalhe = 'não foi informado'
  } else if (ehMensagemNossa(problema.message)) {
    detalhe = problema.message
  } else if (problema.code === 'invalid_value' && Array.isArray(problema.values)) {
    detalhe = 'não é uma opção válida'
  } else {
    detalhe = 'está em formato inválido'
  }

  return Response.json({ erro: campo ? `${campo}: ${detalhe}` : detalhe }, { status: 400 })
}

type ZodIssue = {
  code: string
  path: PropertyKey[]
  message: string
  values?: unknown[]
}
