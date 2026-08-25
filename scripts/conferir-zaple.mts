// Fuma o cliente do Zaple contra a API de produção. Só leitura.
import { listarEtapas } from '@/lib/zaple/painel'
import { listarVisitas } from '@/lib/zaple/visitas'
import { buscarContatosPorNome, buscarContatoPorTelefone } from '@/lib/zaple/contatos'
import { listarAgentes } from '@/lib/zaple/agentes'

const etapas = await listarEtapas()
console.log('etapas:', etapas.map((e) => e.titulo).join(' → '))

const visitas = await listarVisitas({})
console.log('visitas no painel:', visitas.total)

const agentes = await listarAgentes()
console.log('agentes:', agentes.length, '| primeiro:', agentes[0]?.nome)

const porNome = await buscarContatosPorNome('VITOR')
console.log('contatos com "VITOR":', porNome.length, '|', porNome.map((c) => c.nome).join(', '))

const porTelefone = await buscarContatoPorTelefone('(21) 97723-7528')
console.log('busca por telefone:', porTelefone?.nome, '|', porTelefone?.telefone)

const inexistente = await buscarContatoPorTelefone('21900000000')
console.log('telefone inexistente devolve:', inexistente)
