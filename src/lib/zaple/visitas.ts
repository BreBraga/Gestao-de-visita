import { zapleGet, zaplePost, zaplePut } from './client'
import { painelId } from './painel'
import type { Pagina, Visita } from './tipos'

const TAMANHO_MAXIMO = 100
const DETALHES = ['StepTitle', 'ResponsibleUser', 'Contacts']

type CardApi = {
  id: string
  key: string
  number: number
  title: string
  description: string | null
  stepId: string
  stepTitle: string | null
  position: number
  dueDate: string | null
  isOverdue: boolean
  responsibleUserId: string | null
  responsibleUser: { id: string; name: string } | null
  contacts: { id: string; name: string }[] | null
  contactIds: string[] | null
  metadata: Record<string, string> | null
  createdAt: string
  updatedAt: string
}

type PaginaApi<T> = {
  items: T[]
  totalItems: number
  hasMorePages: boolean
}

function paraVisita(c: CardApi): Visita {
  return {
    id: c.id,
    chave: c.key,
    numero: c.number,
    titulo: c.title,
    descricao: c.description,
    etapaId: c.stepId,
    etapaTitulo: c.stepTitle,
    posicao: c.position,
    prazo: c.dueDate,
    atrasada: c.isOverdue,
    responsavelId: c.responsibleUserId,
    responsavelNome: c.responsibleUser?.name ?? null,
    contatos: (c.contacts ?? []).map((k) => ({ id: k.id, nome: k.name })),
    metadata: c.metadata,
    criadaEm: c.createdAt,
    atualizadaEm: c.updatedAt,
  }
}

export type FiltroVisitas = {
  etapaId?: string
  responsavelId?: string
  busca?: string
  pagina?: number
  tamanho?: number
}

export async function listarVisitas(filtro: FiltroVisitas): Promise<Pagina<Visita>> {
  const pagina = await zapleGet<PaginaApi<CardApi>>('/crm/v2/panel/card', {
    PanelId: painelId(),
    StepId: filtro.etapaId,
    ResponsibleUserId: filtro.responsavelId,
    TextFilter: filtro.busca,
    Statuses: 'OPEN',
    IncludeDetails: DETALHES,
    PageNumber: filtro.pagina ?? 1,
    PageSize: Math.min(filtro.tamanho ?? TAMANHO_MAXIMO, TAMANHO_MAXIMO),
    OrderBy: 'Position',
    OrderDirection: 'ASCENDING',
  })

  return {
    itens: pagina.items.map(paraVisita),
    total: pagina.totalItems,
    temMais: pagina.hasMorePages,
  }
}

export async function obterVisita(id: string): Promise<Visita> {
  const card = await zapleGet<CardApi>(`/crm/v2/panel/card/${id}`, { IncludeDetails: DETALHES })
  return paraVisita(card)
}

export type NovaVisita = {
  etapaId: string
  titulo: string
  responsavelId: string
  contatoIds: string[]
  prazo?: string
  descricao?: string
}

export async function criarVisita(entrada: NovaVisita): Promise<Visita> {
  // Regra nossa: a API do Zaple aceita card órfão, mas card órfão é invisível
  // para o vendedor e incontável para o gestor.
  if (!entrada.responsavelId) throw new Error('Visita precisa de um responsável')
  if (entrada.contatoIds.length === 0) throw new Error('Visita precisa de ao menos um contato')

  const card = await zaplePost<CardApi>('/crm/v2/panel/card', {
    stepId: entrada.etapaId,
    title: entrada.titulo,
    responsibleUserId: entrada.responsavelId,
    contactIds: entrada.contatoIds,
    ...(entrada.prazo ? { dueDate: entrada.prazo } : {}),
    ...(entrada.descricao ? { description: entrada.descricao } : {}),
  })
  return paraVisita(card)
}

export type PatchVisita = Partial<{
  etapaId: string
  titulo: string
  descricao: string
  prazo: string | null
  responsavelId: string
  contatoIds: string[]
  posicao: number
  metadata: Record<string, string>
}>

/**
 * O PUT v3 do Zaple ignora silenciosamente qualquer campo que não esteja
 * declarado em `fields`. Este mapa é a única fonte dessa correspondência.
 */
const CAMPOS: Record<keyof PatchVisita, { field: string; chave: string }> = {
  etapaId: { field: 'StepId', chave: 'stepId' },
  titulo: { field: 'Title', chave: 'title' },
  descricao: { field: 'Description', chave: 'description' },
  prazo: { field: 'DueDate', chave: 'dueDate' },
  responsavelId: { field: 'ResponsibleUserId', chave: 'responsibleUserId' },
  contatoIds: { field: 'ContactIds', chave: 'contactIds' },
  posicao: { field: 'Position', chave: 'position' },
  metadata: { field: 'Metadata', chave: 'metadata' },
}

export async function atualizarVisita(id: string, patch: PatchVisita): Promise<Visita> {
  const fields: string[] = []
  const corpo: Record<string, unknown> = {}

  for (const [nome, valor] of Object.entries(patch) as [keyof PatchVisita, unknown][]) {
    if (valor === undefined) continue
    const mapa = CAMPOS[nome]
    fields.push(mapa.field)
    corpo[mapa.chave] = valor
  }

  if (fields.length === 0) throw new Error('nada para atualizar')

  const card = await zaplePut<CardApi>(`/crm/v3/panel/card/${id}`, { fields, ...corpo })
  return paraVisita(card)
}

export function moverEtapa(id: string, etapaId: string): Promise<Visita> {
  return atualizarVisita(id, { etapaId })
}
