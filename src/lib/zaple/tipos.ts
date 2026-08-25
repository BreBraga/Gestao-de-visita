export type Etapa = {
  id: string
  titulo: string
  posicao: number
  inicial: boolean
  final: boolean
}

export type ContatoResumo = {
  id: string
  nome: string
}

export type Visita = {
  id: string
  chave: string // "PDV-1"
  numero: number
  titulo: string
  descricao: string | null
  etapaId: string
  etapaTitulo: string | null
  posicao: number
  prazo: string | null // ISO 8601
  atrasada: boolean
  responsavelId: string | null
  responsavelNome: string | null
  contatos: ContatoResumo[]
  metadata: Record<string, string> | null
  criadaEm: string
  atualizadaEm: string
}

export type Contato = {
  id: string
  nome: string
  telefone: string | null // formato de exibição: (21) 97723-7528
  email: string | null
}

export type Agente = {
  /** Id do atendente. NÃO é o que aparece em card algum — veja `userId`. */
  id: string
  /**
   * Id do usuário por trás do atendente. É ESTE que os cards trazem em
   * `responsibleUserId`, e portanto é ele que vincula um vendedor às visitas
   * dele. Verificado contra produção em 2026-08-24.
   */
  userId: string
  nome: string
  email: string | null
  telefone: string | null
}

export type Pagina<T> = {
  itens: T[]
  total: number
  temMais: boolean
}
