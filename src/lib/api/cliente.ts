/**
 * Lê a mensagem de erro que a API mandou no corpo, sem nunca lançar.
 *
 * O `(await r.json()).erro` cru estoura quando o corpo não é JSON — 500 de
 * corpo vazio, HTML de proxy, resposta truncada. Como essa chamada mora
 * dentro do `try` cujo `catch` existe para falha de rede, o estouro faz a
 * tela anunciar "Sem conexão" para quem está perfeitamente conectado, e
 * esconde o motivo real da recusa.
 */
export async function erroDaResposta(r: Response, padrao: string): Promise<string> {
  try {
    const corpo = await r.json()
    return typeof corpo?.erro === 'string' && corpo.erro ? corpo.erro : padrao
  } catch {
    return padrao
  }
}
