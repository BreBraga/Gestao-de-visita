import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type Conexao = ReturnType<typeof drizzle<typeof schema>>

let conexao: Conexao | undefined

function conectar(): Conexao {
  if (conexao) return conexao

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não configurado')

  const cliente = postgres(url, {
    // O pooler de transação do Supabase (porta 6543) não suporta prepared
    // statements: cada requisição pode cair numa conexão diferente do pool,
    // e o statement preparado na anterior não existe lá. Sem isso, o app
    // funciona no primeiro acesso e falha de forma intermitente depois.
    prepare: false,
    // Serverless: cada instância é efêmera, então um punhado de conexões por
    // instância basta e evita estourar o limite do projeto.
    max: 3,
    idle_timeout: 20,
  })

  conexao = drizzle(cliente, { schema })
  return conexao
}

/**
 * Conexão preguiçosa de propósito: se o erro fosse lançado no import, o build
 * e os testes passariam a exigir um banco de verdade só para carregar módulos
 * que talvez nem consultem nada.
 */
export const db = new Proxy({} as Conexao, {
  get: (_alvo, prop) => Reflect.get(conectar(), prop),
})

export * from './schema'
