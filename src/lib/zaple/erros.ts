/**
 * A API do Zaple não usa 404 para "não existe". Verificado em 2026-08-24:
 * GET /core/v1/contact/phoneNumber/{inexistente} responde HTTP 500 com
 * `key: FORM_ERROR` e `text: "Contato não encontrado"`. O único sinal
 * confiável é o texto.
 */
const TEXTO_NAO_ENCONTRADO = /n[ãa]o (foi )?encontrad[oa]/i

export class ZapleError extends Error {
  readonly key: string
  readonly status: number
  /** Erro de permissão do token — repetir a chamada não resolve. */
  readonly autorizacao: boolean
  /** O recurso não existe. Costuma ser resposta válida, não falha. */
  readonly naoEncontrado: boolean

  constructor(key: string, status: number, mensagem: string) {
    super(mensagem)
    this.name = 'ZapleError'
    this.key = key
    this.status = status
    this.autorizacao = key === 'ERROR_UNAUTHORIZED' || status === 401 || status === 403
    this.naoEncontrado = !this.autorizacao && (status === 404 || TEXTO_NAO_ENCONTRADO.test(mensagem))
  }
}

/** Erros transitórios: vale repetir. */
export function vaTentarDeNovo(erro: unknown): boolean {
  if (erro instanceof ZapleError) {
    if (erro.autorizacao) return false
    // Sem esta guarda, todo "cliente ainda não cadastrado" — o caminho mais
    // comum ao criar visita — gastaria três tentativas e quase um segundo de
    // espera, porque a API devolve 500 para dizer "não existe".
    if (erro.naoEncontrado) return false
    return erro.status >= 500 || erro.status === 429
  }
  return true // falha de rede
}
