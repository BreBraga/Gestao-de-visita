import { zapleGet } from './client'
import type { Agente } from './tipos'

type AgenteApi = {
  id: string
  userId: string
  name: string
  email: string | null
  phoneNumberFormatted: string | null
  phoneNumber: string | null
}

export async function listarAgentes(): Promise<Agente[]> {
  // Este endpoint devolve um array cru, sem envelope de paginação — ao
  // contrário de quase todos os outros da API.
  const agentes = await zapleGet<AgenteApi[]>('/core/v1/agent', { PageSize: 100 })
  return agentes
    .map((a) => ({
      id: a.id,
      userId: a.userId,
      nome: a.name,
      email: a.email,
      telefone: a.phoneNumberFormatted ?? a.phoneNumber,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}
