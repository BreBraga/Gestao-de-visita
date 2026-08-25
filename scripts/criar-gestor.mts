// Cria o primeiro gestor. Sem ele ninguém consegue entrar na tela que
// cadastra pessoas — é o problema do ovo e da galinha do admin.
import { criarUsuario } from '@/lib/auth/usuarios'
import { listarAgentes } from '@/lib/zaple/agentes'

const [nome, telefone, senha, agentId] = process.argv.slice(2)

if (!nome || !telefone || !senha || !agentId) {
  console.error('uso: criar-gestor.mts <nome> <telefone> <senha> <zapleUserId>\n')
  console.error('Agentes disponíveis no Zaple:')
  console.table(await listarAgentes())
  process.exit(1)
}

const u = await criarUsuario({ nome, telefone, senha, zapleUserId: agentId, papel: 'gestor' })
console.log('gestor criado:', u.nome, '|', u.telefone)
