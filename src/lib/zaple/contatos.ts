import { zapleGet, zaplePost } from './client'
import { ZapleError } from './erros'
import type { Contato } from './tipos'

type ContatoApi = {
  id: string
  name: string
  phoneNumber: string | null
  phoneNumberFormatted: string | null
  email: string | null
}

/**
 * O Zaple armazena telefone como "+55|21977237528" e busca por
 * "5521977237528". Esta função é a única tradução entre os dois mundos.
 *
 * A guarda de comprimento existe porque 55 também é o DDD do Rio Grande do
 * Sul: "(55) 99988-7766" começa com 55 mas ainda precisa do DDI.
 */
export function normalizarTelefone(bruto: string): string {
  const digitos = bruto.replace(/\D/g, '')
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos
  return '55' + digitos
}

function paraContato(c: ContatoApi): Contato {
  return {
    id: c.id,
    nome: c.name,
    telefone: c.phoneNumberFormatted ?? c.phoneNumber,
    email: c.email,
  }
}

/**
 * A busca por nome é POST /contact/filter, não GET /contact com parâmetro.
 * Verificado em 2026-08-24: TextFilter, Search, Name e Query no GET são
 * ignorados em silêncio — a chamada devolve a base inteira como se tivesse
 * filtrado.
 */
export async function buscarContatosPorNome(nome: string, limite = 20): Promise<Contato[]> {
  const pagina = await zaplePost<{ items: ContatoApi[] }>(
    '/core/v1/contact/filter',
    { name: nome },
    { PageSize: Math.min(limite, 100) }
  )
  return pagina.items.map(paraContato)
}

export async function buscarContatoPorTelefone(telefone: string): Promise<Contato | null> {
  try {
    const c = await zapleGet<ContatoApi>(`/core/v1/contact/phoneNumber/${normalizarTelefone(telefone)}`)
    return paraContato(c)
  } catch (erro) {
    // "Não existe" é uma resposta válida da busca. "Sem permissão" não é —
    // engolir isso como null esconderia um token quebrado por semanas.
    if (erro instanceof ZapleError && erro.naoEncontrado) return null
    throw erro
  }
}

export async function criarContato(entrada: { nome: string; telefone: string }): Promise<Contato> {
  const c = await zaplePost<ContatoApi>('/core/v1/contact', {
    name: entrada.nome,
    phoneNumber: normalizarTelefone(entrada.telefone),
  })
  return paraContato(c)
}
