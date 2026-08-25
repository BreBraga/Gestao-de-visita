import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '@/lib/db/schema'

/**
 * Postgres de verdade, em memória, com as migrações reais aplicadas.
 *
 * Testar repositório contra mock de SQL testa o mock: o `where` errado, a
 * coluna com nome trocado e a constraint violada passariam todos. Aqui não —
 * é o mesmo motor que roda em produção.
 */
export async function criarBancoDeTeste() {
  const cliente = new PGlite()
  const db = drizzle(cliente, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })

  return {
    db,
    fechar: () => cliente.close(),
  }
}

/**
 * Contador por processo. Cada arquivo de teste tem seu próprio banco em
 * memória, então uma sequência simples basta e é imune ao formato do id.
 */
let sequencia = 0

/**
 * Um vendedor pronto, porque `visita.usuario_id` tem foreign key.
 *
 * O telefone vem de um contador, não do `zapleUserId`, porque `usuario.telefone`
 * é unique e UUID é hexadecimal: derivar dígitos dele (ex.: descartando letras)
 * colide — `ffffffff-...` e `00000000-...` gerariam o mesmo telefone. O erro
 * apareceria como falha de banco, não como asserção, mandando quem estiver
 * depurando para o lugar errado.
 */
export async function criarUsuarioDeTeste(
  db: Awaited<ReturnType<typeof criarBancoDeTeste>>['db'],
  zapleUserId = '11111111-1111-1111-1111-111111111111'
) {
  const [u] = await db
    .insert(schema.usuario)
    .values({
      nome: 'Vendedor de Teste',
      telefone: `5521${String(++sequencia).padStart(9, '0')}`,
      senhaHash: 'nao-importa',
      zapleUserId,
    })
    .returning()
  return u
}
