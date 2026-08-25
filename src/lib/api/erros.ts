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
