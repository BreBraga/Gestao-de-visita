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
    //
    // Cai para 1 com DB_POOL_MAX=1, que é o que o Postgres embarcado do
    // desenvolvimento local exige: o PGlite serve tudo por uma conexão só, e
    // multiplexa mal statements concorrentes. Como o /painel dispara três
    // consultas em paralelo, com pool maior que 1 ele responde
    // "unnamed prepared statement does not exist" e a tela quebra — só
    // localmente, nunca contra um Postgres de verdade.
    max: Number(process.env.DB_POOL_MAX ?? 3),
    idle_timeout: 20,
    connection: {
      // Uma consulta que passa de 15s aqui não está lenta, está presa: as
      // telas leem tabelas pequenas e por índice. Sem teto, ela ocupa uma das
      // três conexões até alguém perceber.
      statement_timeout: 15_000,
      // O teto que importa de verdade. `reagendar` e `realizarComRetorno`
      // abrem transação, e uma requisição que morre no meio — o serverless
      // desligando a instância, o navegador desistindo — deixaria a transação
      // aberta segurando a conexão. Observado em desenvolvimento: uma
      // transação órfã travou o app inteiro por nove minutos, com o Postgres
      // parado em Client/ClientRead esperando um cliente que não voltaria.
      idle_in_transaction_session_timeout: 10_000,
    },
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
