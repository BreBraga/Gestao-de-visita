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
 * Um vendedor pronto, porque `visita.usuario_id` tem foreign key.
 *
 * O telefone é derivado do `zapleUserId` porque `usuario.telefone` é unique:
 * com um valor fixo, o segundo vendedor de um mesmo teste estouraria a
 * constraint — e o erro apareceria como falha de banco, não como asserção,
 * mandando quem estiver depurando para o lugar errado.
 */
export async function criarUsuarioDeTeste(
  db: Awaited<ReturnType<typeof criarBancoDeTeste>>['db'],
  zapleUserId = '11111111-1111-1111-1111-111111111111'
) {
  const sufixo = zapleUserId.replace(/\D/g, '').slice(0, 9).padEnd(9, '0')
  const [u] = await db
    .insert(schema.usuario)
    .values({
      nome: 'Vendedor de Teste',
      telefone: `55${sufixo}`,
      senhaHash: 'nao-importa',
      zapleUserId,
    })
    .returning()
  return u
}
