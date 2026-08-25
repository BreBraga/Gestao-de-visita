# Fatia A — Inversão da fonte da verdade — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover a visita do Zaple para o nosso Postgres, tornando o app dono do dado e o CRM um destino de cópia.

**Architecture:** Uma tabela `visita` no Postgres passa a ser a fonte da verdade. Um repositório concentra todo o SQL; um sincronizador espelha cada visita como card no Zaple e nunca bloqueia o vendedor quando a API de lá falha. A tela do vendedor deixa de ser kanban e vira agenda por data.

**Tech Stack:** Next.js 16.3.2 (App Router), React 19, Drizzle ORM 0.45, postgres.js, PGlite (testes e dev local), Vitest 4, Zod 4, TypeScript 5.

**Spec:** [`docs/superpowers/specs/2026-08-25-inversao-fonte-da-verdade-design.md`](../specs/2026-08-25-inversao-fonte-da-verdade-design.md)

## Global Constraints

- **Nenhuma credencial recebe o prefixo `NEXT_PUBLIC_`.** Todas as variáveis são de servidor.
- **Nada fora de `src/lib/zaple/` monta URL da API do Zaple ou lê `ZAPLE_TOKEN`.**
- **Falha do Zaple nunca impede a visita de existir.** É a razão de ser desta fatia.
- **O card aponta para `agent.userId`, não para `agent.id`.** Vincular ao `id` deixa o vendedor sem visita nenhuma, em silêncio.
- **A API do Zaple sinaliza erro pelo corpo (`error: true`), às vezes com HTTP 200.** Conferir só o status deixa erro passar como dado.
- Status válidos, exatamente estes quatro: `a_fazer`, `realizada`, `cancelada`, `reagendada`.
- Tipos válidos, exatamente estes dois: `prospeccao`, `recorrente`.
- Datas de visita trafegam como `'YYYY-MM-DD'` (string), nunca como `Date`, para o fuso não empurrar a visita para o dia anterior.
- Todo texto de interface em português do Brasil, com acentuação correta.
- Comentários explicam **por quê**, não o quê — é o estilo do restante do código.

---

## Task 0: Rede de segurança antes de descartar código

Esta fatia apaga código que funciona e está verificado. Sem git, não há volta.

**Files:**
- Create: `.git/` (via `git init`)

- [ ] **Step 1: Confirmar que não existe repositório**

```bash
git -C /Users/davi/Desktop/Gestao-de-visita-main rev-parse --is-inside-work-tree 2>&1
```

Esperado: `fatal: not a git repository`. Se responder `true`, pule esta task inteira.

- [ ] **Step 2: Inicializar e verificar o que o .gitignore protege**

```bash
git init
git status --short | grep -E "^\?\? \.env$" && echo "PERIGO: .env seria versionado" || echo "ok: .env ignorado"
```

Esperado: `ok: .env ignorado`. O `.gitignore` do projeto já ignora `.env*` exceto `.env.example`. **Se aparecer PERIGO, pare e corrija o `.gitignore` antes de continuar** — o `.env` contém o token do Zaple e a senha do banco.

- [ ] **Step 3: Commit do estado atual**

```bash
git add -A
git status --short | head -30
git commit -m "chore: estado da Fatia 1 antes da inversão da fonte da verdade"
```

Antes de confirmar, leia a lista do `git status`: nenhum `.env`, nenhuma pasta `.banco-local/`, nenhum `node_modules`.

---

## Task 1: Tabela `visita`

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `tests/db/visita-schema.test.ts`
- Create: `drizzle/0001_*.sql` (gerado)

**Interfaces:**
- Consumes: nada.
- Produces: `visita` (tabela drizzle), `statusVisitaEnum`, `tipoVisitaEnum`, e os tipos `Visita = typeof visita.$inferSelect` e `NovaLinhaVisita = typeof visita.$inferInsert`, todos exportados de `@/lib/db`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/db/visita-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { visita } from '@/lib/db/schema'

describe('tabela visita', () => {
  const config = getTableConfig(visita)
  const colunas = Object.fromEntries(config.columns.map((c) => [c.name, c]))

  it('tem as colunas que a agenda e o dashboard precisam', () => {
    for (const nome of [
      'id',
      'contato_id',
      'contato_nome',
      'usuario_id',
      'zaple_user_id',
      'data',
      'status',
      'tipo',
      'titulo',
      'relatorio',
      'origem_id',
      'card_id',
      'sincronizado_em',
      'criada_em',
      'atualizada_em',
    ]) {
      expect(colunas[nome], `faltou a coluna ${nome}`).toBeDefined()
    }
  })

  it('congela o nome do cliente para o dashboard não consultar o Zaple por linha', () => {
    expect(colunas['contato_nome'].notNull).toBe(true)
  })

  it('exige o vínculo com o agente do Zaple, como a tabela usuario', () => {
    expect(colunas['zaple_user_id'].notNull).toBe(true)
  })

  it('nasce a fazer', () => {
    expect(colunas['status'].hasDefault).toBe(true)
  })

  it('deixa nulo o que só existe depois — relatório, card e sincronismo', () => {
    expect(colunas['relatorio'].notNull).toBe(false)
    expect(colunas['card_id'].notNull).toBe(false)
    expect(colunas['sincronizado_em'].notNull).toBe(false)
    expect(colunas['origem_id'].notNull).toBe(false)
  })

  it('não tem coluna de coordenada — sem endereço do cliente o GPS não significa nada', () => {
    expect(Object.keys(colunas)).not.toContain('latitude')
    expect(Object.keys(colunas)).not.toContain('longitude')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run tests/db/visita-schema.test.ts
```

Esperado: FALHA — `visita` não é exportado de `@/lib/db/schema`.

- [ ] **Step 3: Implementar o schema**

Em `src/lib/db/schema.ts`, adicione ao final (mantendo `usuario` e `tentativaLogin` como estão):

```ts
export const statusVisitaEnum = pgEnum('status_visita', [
  'a_fazer',
  'realizada',
  'cancelada',
  'reagendada',
])

export const tipoVisitaEnum = pgEnum('tipo_visita', ['prospeccao', 'recorrente'])

/**
 * A visita mora aqui, não no Zaple. O card de lá é cópia: se a API estiver
 * fora do ar, a visita existe do mesmo jeito e `sincronizado_em` fica nulo.
 */
export const visita = pgTable(
  'visita',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** O cliente no Zaple. */
    contatoId: uuid('contato_id').notNull(),
    /**
     * Congelado na criação. Sem isto, montar o dashboard exigiria uma chamada
     * à API do Zaple por linha, e renomear um cliente reescreveria o passado.
     */
    contatoNome: text('contato_nome').notNull(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuario.id),
    /** O mesmo `responsibleUserId` do card. Ver o comentário em `usuario`. */
    zapleUserId: uuid('zaple_user_id').notNull(),
    /** Só a data, sem hora: o fuso não pode empurrar a visita para ontem. */
    data: date('data', { mode: 'string' }).notNull(),
    status: statusVisitaEnum('status').notNull().default('a_fazer'),
    tipo: tipoVisitaEnum('tipo').notNull().default('prospeccao'),
    titulo: text('titulo').notNull(),
    relatorio: text('relatorio'),
    /** De qual visita esta foi reagendada. Ver `reagendar()`. */
    origemId: uuid('origem_id'),
    /** O card espelho no Zaple. Nulo até a cópia chegar lá. */
    cardId: uuid('card_id'),
    sincronizadoEm: timestamp('sincronizado_em', { withTimezone: true }),
    criadaEm: timestamp('criada_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadaEm: timestamp('atualizada_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // A consulta mais frequente do app: a agenda de um vendedor num dia.
    index('idx_visita_usuario_data').on(t.usuarioId, t.data),
    // A do dashboard: tudo de um período, agrupado por status.
    index('idx_visita_data_status').on(t.data, t.status),
  ]
)

export type Visita = typeof visita.$inferSelect
export type NovaLinhaVisita = typeof visita.$inferInsert
```

Ajuste o import do topo do arquivo para incluir `date`:

```ts
import { pgTable, uuid, text, boolean, timestamp, date, pgEnum, index } from 'drizzle-orm/pg-core'
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run tests/db/visita-schema.test.ts
```

Esperado: PASSA, 6 casos.

- [ ] **Step 5: Gerar e aplicar a migração**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

O `generate` cria `drizzle/0001_*.sql`. Abra o arquivo e confirme que ele tem `CREATE TYPE` para os dois enums e `CREATE TABLE "visita"`. O `migrate` aplica no banco de `DIRECT_URL`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts tests/db/visita-schema.test.ts drizzle/
git commit -m "feat(db): tabela visita como fonte da verdade"
```

---

## Task 2: Banco de verdade nos testes

O repositório da próxima task faz SQL real. Mockar SQL testaria o mock. Esta task monta um Postgres em memória que aplica as migrações reais — verificado funcionando em 2026-08-25.

**Files:**
- Create: `tests/apoio/banco.ts`

**Interfaces:**
- Consumes: `drizzle/` (as migrações da Task 1).
- Produces: `criarBancoDeTeste(): Promise<{ db, fechar }>`, onde `db` é uma conexão drizzle com o schema completo e `fechar()` encerra o PGlite.

- [ ] **Step 1: Escrever o helper**

Crie `tests/apoio/banco.ts`:

```ts
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
 * O telefone vem de um contador, não do `zapleUserId`, porque
 * `usuario.telefone` é unique e UUID é hexadecimal: derivar do id descartando
 * as letras faria `ffffffff-…` e `00000000-…` virarem o mesmo telefone — e o
 * segundo vendedor do teste morreria com erro de constraint em vez de falha
 * de asserção, mandando quem depura para o lugar errado.
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
```

- [ ] **Step 2: Provar que o helper funciona**

Crie `tests/apoio/banco.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { criarBancoDeTeste, criarUsuarioDeTeste } from './banco'
import { visita } from '@/lib/db/schema'

describe('banco de teste', () => {
  it('aplica as migrações e aceita uma visita', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    const u = await criarUsuarioDeTeste(db)

    const [v] = await db
      .insert(visita)
      .values({
        contatoId: '22222222-2222-2222-2222-222222222222',
        contatoNome: 'AUTOCAR',
        usuarioId: u.id,
        zapleUserId: u.zapleUserId,
        data: '2026-08-25',
        titulo: 'AUTOCAR',
      })
      .returning()

    expect(v.status).toBe('a_fazer')
    expect(v.tipo).toBe('prospeccao')
    expect(v.sincronizadoEm).toBeNull()
    await fechar()
  })
})
```

- [ ] **Step 3: Ajustar o vitest para enxergar o novo arquivo**

`vitest.config.mts` inclui `tests/**/*.test.ts`, então `tests/apoio/banco.test.ts` já entra. **Nenhuma mudança necessária** — confirme rodando:

```bash
npx vitest run tests/apoio/banco.test.ts
```

Esperado: PASSA.

- [ ] **Step 4: Commit**

```bash
git add tests/apoio/
git commit -m "test: banco Postgres em memória com migrações reais"
```

---

## Task 3: Repositório — criar e buscar

**Files:**
- Create: `src/lib/visita/repositorio.ts`
- Create: `tests/visita/repositorio.test.ts`

**Interfaces:**
- Consumes: `criarBancoDeTeste`, `criarUsuarioDeTeste` (Task 2); `visita`, `Visita` (Task 1).
- Produces:
  - `type EntradaVisita = { contatoId: string; contatoNome: string; usuarioId: string; zapleUserId: string; data: string; titulo: string; tipo?: 'prospeccao' | 'recorrente' }`
  - `criarVisita(db: BancoVisita, entrada: EntradaVisita): Promise<Visita>`
  - `buscarVisita(db: BancoVisita, id: string): Promise<Visita | null>`
  - `type BancoVisita` — a conexão drizzle, passada por parâmetro para o teste injetar a de memória.

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/visita/repositorio.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { criarBancoDeTeste, criarUsuarioDeTeste } from '../apoio/banco'
import { criarVisita, buscarVisita } from '@/lib/visita/repositorio'

const CONTATO = '22222222-2222-2222-2222-222222222222'

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>
let usuarioId: string
let zapleUserId: string

beforeEach(async () => {
  banco = await criarBancoDeTeste()
  const u = await criarUsuarioDeTeste(banco.db)
  usuarioId = u.id
  zapleUserId = u.zapleUserId
})

afterEach(async () => {
  await banco.fechar()
})

function entrada(sobrescreve: Partial<Parameters<typeof criarVisita>[1]> = {}) {
  return {
    contatoId: CONTATO,
    contatoNome: 'AUTOCAR',
    usuarioId,
    zapleUserId,
    data: '2026-08-25',
    titulo: 'AUTOCAR',
    ...sobrescreve,
  }
}

describe('criarVisita', () => {
  it('nasce a fazer, sem card e sem sincronismo', async () => {
    const v = await criarVisita(banco.db, entrada())

    expect(v.status).toBe('a_fazer')
    expect(v.cardId).toBeNull()
    expect(v.sincronizadoEm).toBeNull()
    expect(v.contatoNome).toBe('AUTOCAR')
  })

  it('guarda a data como string, sem deixar o fuso mover o dia', async () => {
    const v = await criarVisita(banco.db, entrada({ data: '2026-01-01' }))

    expect(v.data).toBe('2026-01-01')
  })

  it('aceita o tipo recorrente', async () => {
    const v = await criarVisita(banco.db, entrada({ tipo: 'recorrente' }))

    expect(v.tipo).toBe('recorrente')
  })
})

describe('buscarVisita', () => {
  it('devolve a visita pelo id', async () => {
    const criada = await criarVisita(banco.db, entrada())

    const achada = await buscarVisita(banco.db, criada.id)

    expect(achada?.id).toBe(criada.id)
  })

  it('devolve null quando não existe, em vez de estourar', async () => {
    const achada = await buscarVisita(banco.db, '33333333-3333-3333-3333-333333333333')

    expect(achada).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run tests/visita/repositorio.test.ts
```

Esperado: FALHA — `@/lib/visita/repositorio` não existe.

- [ ] **Step 3: Implementar**

Crie `src/lib/visita/repositorio.ts`:

```ts
import { eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { db as bancoPadrao, visita, type Visita } from '@/lib/db'
import type * as schema from '@/lib/db/schema'

/**
 * A conexão entra por parâmetro para o teste injetar o Postgres em memória.
 * Em produção quem chama passa `bancoPadrao`, exportado aqui como `db`.
 *
 * O tipo é o `PgDatabase` genérico, e não `typeof bancoPadrao`, porque cada
 * driver do Drizzle carrega o próprio `QueryResultHKT`: o tipo da conexão de
 * produção (postgres-js) recusa a de teste (PGlite) em tempo de compilação,
 * mesmo com as duas sendo Drizzle válidas. O Vitest não type-checa, então o
 * teste passaria e só o `next build` quebraria — longe daqui.
 */
export type BancoVisita = PgDatabase<PgQueryResultHKT, typeof schema>

export { bancoPadrao as db }

export type EntradaVisita = {
  contatoId: string
  contatoNome: string
  usuarioId: string
  zapleUserId: string
  data: string
  titulo: string
  tipo?: 'prospeccao' | 'recorrente'
}

export async function criarVisita(db: BancoVisita, entrada: EntradaVisita): Promise<Visita> {
  const [criada] = await db
    .insert(visita)
    .values({
      contatoId: entrada.contatoId,
      contatoNome: entrada.contatoNome,
      usuarioId: entrada.usuarioId,
      zapleUserId: entrada.zapleUserId,
      data: entrada.data,
      titulo: entrada.titulo,
      tipo: entrada.tipo ?? 'prospeccao',
    })
    .returning()
  return criada
}

export async function buscarVisita(db: BancoVisita, id: string): Promise<Visita | null> {
  const [achada] = await db.select().from(visita).where(eq(visita.id, id)).limit(1)
  return achada ?? null
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run tests/visita/repositorio.test.ts
```

Esperado: PASSA, 5 casos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/visita/repositorio.ts tests/visita/repositorio.test.ts
git commit -m "feat(visita): repositório com criar e buscar"
```

---

## Task 4: Repositório — a agenda do dia

**Files:**
- Modify: `src/lib/visita/repositorio.ts`
- Modify: `tests/visita/repositorio.test.ts`

**Interfaces:**
- Consumes: `criarVisita`, `BancoVisita` (Task 3).
- Produces: `listarDoDia(db: BancoVisita, opcoes: { data: string; usuarioId?: string }): Promise<Visita[]>` — sem `usuarioId`, devolve todos (o "ver todos" do gestor).

- [ ] **Step 1: Escrever o teste que falha**

Acrescente ao final de `tests/visita/repositorio.test.ts`:

```ts
import { listarDoDia } from '@/lib/visita/repositorio'
import { criarUsuarioDeTeste as criarOutroUsuario } from '../apoio/banco'

describe('listarDoDia', () => {
  it('traz só as visitas do dia pedido', async () => {
    await criarVisita(banco.db, entrada({ data: '2026-08-25', titulo: 'DE HOJE' }))
    await criarVisita(banco.db, entrada({ data: '2026-08-26', titulo: 'DE AMANHÃ' }))

    const doDia = await listarDoDia(banco.db, { data: '2026-08-25' })

    expect(doDia).toHaveLength(1)
    expect(doDia[0].titulo).toBe('DE HOJE')
  })

  it('filtra por vendedor quando o usuarioId é passado', async () => {
    const outro = await criarOutroUsuario(banco.db, '99999999-9999-9999-9999-999999999999')
    await criarVisita(banco.db, entrada({ titulo: 'MINHA' }))
    await criarVisita(
      banco.db,
      entrada({ titulo: 'DO OUTRO', usuarioId: outro.id, zapleUserId: outro.zapleUserId })
    )

    const minhas = await listarDoDia(banco.db, { data: '2026-08-25', usuarioId })

    expect(minhas).toHaveLength(1)
    expect(minhas[0].titulo).toBe('MINHA')
  })

  it('sem usuarioId traz todos — é o "ver todos" do gestor', async () => {
    const outro = await criarOutroUsuario(banco.db, '99999999-9999-9999-9999-999999999999')
    await criarVisita(banco.db, entrada({ titulo: 'MINHA' }))
    await criarVisita(
      banco.db,
      entrada({ titulo: 'DO OUTRO', usuarioId: outro.id, zapleUserId: outro.zapleUserId })
    )

    const todas = await listarDoDia(banco.db, { data: '2026-08-25' })

    expect(todas).toHaveLength(2)
  })

  it('ordena por criação, para a lista não dançar a cada refresh', async () => {
    await criarVisita(banco.db, entrada({ titulo: 'PRIMEIRA' }))
    await criarVisita(banco.db, entrada({ titulo: 'SEGUNDA' }))

    const doDia = await listarDoDia(banco.db, { data: '2026-08-25' })

    expect(doDia.map((v) => v.titulo)).toEqual(['PRIMEIRA', 'SEGUNDA'])
  })
})
```

Note o segundo import de `criarUsuarioDeTeste` com apelido: o teste precisa de um segundo vendedor, e o `zapleUserId` tem que ser diferente.

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run tests/visita/repositorio.test.ts
```

Esperado: FALHA — `listarDoDia` não é exportado.

- [ ] **Step 3: Implementar**

Em `src/lib/visita/repositorio.ts`, troque o import de `drizzle-orm` e acrescente a função:

```ts
import { and, asc, eq } from 'drizzle-orm'
```

```ts
export async function listarDoDia(
  db: BancoVisita,
  opcoes: { data: string; usuarioId?: string }
): Promise<Visita[]> {
  // Sem usuarioId a consulta não filtra por vendedor: é o "ver todos" do
  // gestor. Quem chama decide, porque só a rota conhece o papel de quem pediu.
  const filtros = [eq(visita.data, opcoes.data)]
  if (opcoes.usuarioId) filtros.push(eq(visita.usuarioId, opcoes.usuarioId))

  return db
    .select()
    .from(visita)
    .where(and(...filtros))
    .orderBy(asc(visita.criadaEm))
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run tests/visita/repositorio.test.ts
```

Esperado: PASSA, 9 casos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/visita/repositorio.ts tests/visita/repositorio.test.ts
git commit -m "feat(visita): consulta da agenda do dia"
```

---

## Task 5: Repositório — mudar status

**Files:**
- Modify: `src/lib/visita/repositorio.ts`
- Modify: `tests/visita/repositorio.test.ts`

**Interfaces:**
- Consumes: `criarVisita`, `BancoVisita` (Task 3).
- Produces: `mudarStatus(db, id, status: 'realizada' | 'cancelada', relatorio?: string | null): Promise<Visita | null>`.

Reagendar **não** entra aqui: ele cria uma segunda linha e ganha função própria na Task 6.

- [ ] **Step 1: Escrever o teste que falha**

Acrescente a `tests/visita/repositorio.test.ts`:

```ts
import { mudarStatus } from '@/lib/visita/repositorio'

describe('mudarStatus', () => {
  it('marca realizada e guarda o relatório', async () => {
    const v = await criarVisita(banco.db, entrada())

    const alterada = await mudarStatus(banco.db, v.id, 'realizada', 'Cliente fechou 3 carros')

    expect(alterada?.status).toBe('realizada')
    expect(alterada?.relatorio).toBe('Cliente fechou 3 carros')
  })

  it('marca cancelada sem exigir relatório', async () => {
    const v = await criarVisita(banco.db, entrada())

    const alterada = await mudarStatus(banco.db, v.id, 'cancelada')

    expect(alterada?.status).toBe('cancelada')
    expect(alterada?.relatorio).toBeNull()
  })

  it('mexe em atualizada_em, para o sincronizador saber que mudou', async () => {
    const v = await criarVisita(banco.db, entrada())

    const alterada = await mudarStatus(banco.db, v.id, 'realizada')

    expect(alterada!.atualizadaEm.getTime()).toBeGreaterThanOrEqual(v.atualizadaEm.getTime())
  })

  it('devolve null para id que não existe', async () => {
    const alterada = await mudarStatus(
      banco.db,
      '33333333-3333-3333-3333-333333333333',
      'realizada'
    )

    expect(alterada).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run tests/visita/repositorio.test.ts
```

Esperado: FALHA — `mudarStatus` não é exportado.

- [ ] **Step 3: Implementar**

```ts
export async function mudarStatus(
  db: BancoVisita,
  id: string,
  status: 'realizada' | 'cancelada',
  relatorio?: string | null
): Promise<Visita | null> {
  const [alterada] = await db
    .update(visita)
    .set({
      status,
      // `undefined` preserva o relatório que já existe; `null` apaga.
      ...(relatorio !== undefined ? { relatorio } : {}),
      atualizadaEm: new Date(),
      // A cópia no Zaple ficou velha. Nulo põe a visita de volta na fila.
      sincronizadoEm: null,
    })
    .where(eq(visita.id, id))
    .returning()
  return alterada ?? null
}
```

O `sincronizadoEm: null` é o detalhe que faz a fila funcionar: mudar o status
torna a cópia do Zaple desatualizada, e a visita volta a pedir sincronismo.

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run tests/visita/repositorio.test.ts
```

Esperado: PASSA, 13 casos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/visita/repositorio.ts tests/visita/repositorio.test.ts
git commit -m "feat(visita): mudar status marcando a cópia como desatualizada"
```

---

## Task 6: Repositório — reagendar cria duas linhas

A decisão 2.6 da spec: a visita empurrada fecha como `reagendada` e nasce uma nova `a_fazer` na data escolhida, ligada pela `origem_id`. É isso que permite ao dashboard responder "quantas visitas foram empurradas este mês" sem perder a data original.

**Files:**
- Modify: `src/lib/visita/repositorio.ts`
- Modify: `tests/visita/repositorio.test.ts`

**Interfaces:**
- Consumes: `criarVisita`, `buscarVisita`, `BancoVisita` (Task 3).
- Produces: `reagendar(db, id, novaData: string): Promise<{ fechada: Visita; nova: Visita } | null>`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { reagendar } from '@/lib/visita/repositorio'

describe('reagendar', () => {
  it('fecha a original como reagendada e cria uma nova a fazer', async () => {
    const v = await criarVisita(banco.db, entrada({ data: '2026-08-25' }))

    const r = await reagendar(banco.db, v.id, '2026-08-28')

    expect(r?.fechada.status).toBe('reagendada')
    expect(r?.fechada.data).toBe('2026-08-25')
    expect(r?.nova.status).toBe('a_fazer')
    expect(r?.nova.data).toBe('2026-08-28')
  })

  it('liga a nova à original, para o histórico não se perder', async () => {
    const v = await criarVisita(banco.db, entrada())

    const r = await reagendar(banco.db, v.id, '2026-08-28')

    expect(r?.nova.origemId).toBe(v.id)
  })

  it('leva cliente, vendedor, título e tipo para a visita nova', async () => {
    const v = await criarVisita(banco.db, entrada({ tipo: 'recorrente', titulo: 'AUTOCAR' }))

    const r = await reagendar(banco.db, v.id, '2026-08-28')

    expect(r?.nova.contatoId).toBe(v.contatoId)
    expect(r?.nova.contatoNome).toBe(v.contatoNome)
    expect(r?.nova.usuarioId).toBe(v.usuarioId)
    expect(r?.nova.tipo).toBe('recorrente')
    expect(r?.nova.titulo).toBe('AUTOCAR')
  })

  it('a visita reagendada some da agenda do dia original', async () => {
    const v = await criarVisita(banco.db, entrada({ data: '2026-08-25' }))
    await reagendar(banco.db, v.id, '2026-08-28')

    const doDia = await listarDoDia(banco.db, { data: '2026-08-25' })

    // Continua na tabela para o dashboard contar, mas com status reagendada.
    expect(doDia).toHaveLength(1)
    expect(doDia[0].status).toBe('reagendada')
  })

  it('devolve null para id que não existe', async () => {
    const r = await reagendar(banco.db, '33333333-3333-3333-3333-333333333333', '2026-08-28')

    expect(r).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run tests/visita/repositorio.test.ts
```

Esperado: FALHA — `reagendar` não é exportado.

- [ ] **Step 3: Implementar**

```ts
export async function reagendar(
  db: BancoVisita,
  id: string,
  novaData: string
): Promise<{ fechada: Visita; nova: Visita } | null> {
  const original = await buscarVisita(db, id)
  if (!original) return null

  // Duas linhas, não uma. Mudar a data na mesma linha geraria o número de
  // adiamentos, mas apagaria quando cada um aconteceu — e é justamente essa
  // data original que mostra se o vendedor está empurrando cliente com a
  // barriga.
  const [fechada] = await db
    .update(visita)
    .set({ status: 'reagendada', atualizadaEm: new Date(), sincronizadoEm: null })
    .where(eq(visita.id, id))
    .returning()

  const [nova] = await db
    .insert(visita)
    .values({
      contatoId: original.contatoId,
      contatoNome: original.contatoNome,
      usuarioId: original.usuarioId,
      zapleUserId: original.zapleUserId,
      data: novaData,
      titulo: original.titulo,
      tipo: original.tipo,
      origemId: original.id,
    })
    .returning()

  return { fechada, nova }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run tests/visita/repositorio.test.ts
```

Esperado: PASSA, 18 casos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/visita/repositorio.ts tests/visita/repositorio.test.ts
git commit -m "feat(visita): reagendar preservando a data original"
```

---

## Task 7: Repositório — a fila de sincronismo

**Files:**
- Modify: `src/lib/visita/repositorio.ts`
- Modify: `tests/visita/repositorio.test.ts`

**Interfaces:**
- Consumes: `criarVisita`, `mudarStatus`, `BancoVisita`.
- Produces:
  - `listarNaoSincronizadas(db): Promise<Visita[]>`
  - `marcarSincronizada(db, id: string, cardId: string): Promise<void>`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { listarNaoSincronizadas, marcarSincronizada } from '@/lib/visita/repositorio'

describe('fila de sincronismo', () => {
  it('a visita recém-criada está na fila', async () => {
    await criarVisita(banco.db, entrada())

    const fila = await listarNaoSincronizadas(banco.db)

    expect(fila).toHaveLength(1)
  })

  it('sai da fila ao ser marcada, guardando o card', async () => {
    const v = await criarVisita(banco.db, entrada())
    const CARD = '44444444-4444-4444-4444-444444444444'

    await marcarSincronizada(banco.db, v.id, CARD)

    expect(await listarNaoSincronizadas(banco.db)).toHaveLength(0)
    const depois = await buscarVisita(banco.db, v.id)
    expect(depois?.cardId).toBe(CARD)
    expect(depois?.sincronizadoEm).not.toBeNull()
  })

  it('volta para a fila quando o status muda, porque a cópia envelheceu', async () => {
    const v = await criarVisita(banco.db, entrada())
    await marcarSincronizada(banco.db, v.id, '44444444-4444-4444-4444-444444444444')

    await mudarStatus(banco.db, v.id, 'realizada')

    expect(await listarNaoSincronizadas(banco.db)).toHaveLength(1)
  })

  it('mantém o card_id ao voltar para a fila — o espelho é o mesmo', async () => {
    const v = await criarVisita(banco.db, entrada())
    const CARD = '44444444-4444-4444-4444-444444444444'
    await marcarSincronizada(banco.db, v.id, CARD)
    await mudarStatus(banco.db, v.id, 'realizada')

    const depois = await buscarVisita(banco.db, v.id)

    expect(depois?.cardId).toBe(CARD)
  })
})
```

O último caso é o que impede o bug de criar um card novo a cada mudança de status.

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run tests/visita/repositorio.test.ts
```

Esperado: FALHA — funções não exportadas.

- [ ] **Step 3: Implementar**

Troque o import de `drizzle-orm` para incluir `isNull`:

```ts
import { and, asc, eq, isNull } from 'drizzle-orm'
```

```ts
export async function listarNaoSincronizadas(db: BancoVisita): Promise<Visita[]> {
  return db
    .select()
    .from(visita)
    .where(isNull(visita.sincronizadoEm))
    .orderBy(asc(visita.criadaEm))
}

export async function marcarSincronizada(
  db: BancoVisita,
  id: string,
  cardId: string
): Promise<void> {
  await db.update(visita).set({ cardId, sincronizadoEm: new Date() }).where(eq(visita.id, id))
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run tests/visita/repositorio.test.ts
```

Esperado: PASSA, 22 casos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/visita/repositorio.ts tests/visita/repositorio.test.ts
git commit -m "feat(visita): fila de sincronismo por sincronizado_em nulo"
```

---

## Task 8: Mapa de status para etapa do Zaple

A spec (5.1) prevê que o cliente vai renomear as etapas do painel para
`A fazer · Realizada · Cancelada · Reagendada`. Enquanto isso não acontece, o
app precisa funcionar com as etapas antigas — e nunca travar por causa disso.

**Files:**
- Create: `src/lib/visita/etapas.ts`
- Create: `tests/visita/etapas.test.ts`

**Interfaces:**
- Consumes: `Etapa` de `@/lib/zaple/tipos`.
- Produces: `etapaParaStatus(etapas: Etapa[], status: string): Etapa | null`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/visita/etapas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { etapaParaStatus } from '@/lib/visita/etapas'
import type { Etapa } from '@/lib/zaple/tipos'

function etapa(id: string, titulo: string, posicao: number): Etapa {
  return { id, titulo, posicao, inicial: posicao === 1, final: false }
}

const PAINEL_NOVO = [
  etapa('e1', 'A fazer', 1),
  etapa('e2', 'Realizada', 2),
  etapa('e3', 'Cancelada', 3),
  etapa('e4', 'Reagendada', 4),
]

const PAINEL_ANTIGO = [
  etapa('a1', 'Prospecção', 1),
  etapa('a2', 'Visita', 2),
  etapa('a3', 'RECORRENTE', 3),
  etapa('a4', 'Concluído', 4),
]

describe('etapaParaStatus', () => {
  it('acha a etapa pelo nome no painel já renomeado', () => {
    expect(etapaParaStatus(PAINEL_NOVO, 'realizada')?.id).toBe('e2')
    expect(etapaParaStatus(PAINEL_NOVO, 'a_fazer')?.id).toBe('e1')
    expect(etapaParaStatus(PAINEL_NOVO, 'cancelada')?.id).toBe('e3')
    expect(etapaParaStatus(PAINEL_NOVO, 'reagendada')?.id).toBe('e4')
  })

  it('ignora caixa e acento, porque o nome é digitado por gente', () => {
    const painel = [etapa('x', 'REALIZADA', 1)]

    expect(etapaParaStatus(painel, 'realizada')?.id).toBe('x')
  })

  it('cai no apelido antigo enquanto o painel não for renomeado', () => {
    // 'Concluído' é o nome antigo de 'Realizada'.
    expect(etapaParaStatus(PAINEL_ANTIGO, 'realizada')?.id).toBe('a4')
    expect(etapaParaStatus(PAINEL_ANTIGO, 'a_fazer')?.id).toBe('a1')
  })

  it('devolve null quando não existe etapa correspondente', () => {
    expect(etapaParaStatus(PAINEL_ANTIGO, 'cancelada')).toBeNull()
  })
})
```

O último caso é o importante: o painel antigo não tem "Cancelada". O
sincronizador precisa lidar com `null` sem quebrar.

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run tests/visita/etapas.test.ts
```

Esperado: FALHA — módulo não existe.

- [ ] **Step 3: Implementar**

Crie `src/lib/visita/etapas.ts`:

```ts
import type { Etapa } from '@/lib/zaple/tipos'

/**
 * Nomes aceitos por status, em ordem de preferência. O primeiro é o nome novo
 * que o painel vai ter; os seguintes são os apelidos do painel de teste, que
 * ainda está no ar. Sem isto, o sincronismo pararia no dia da renomeação — ou
 * antes dela.
 */
const NOMES: Record<string, string[]> = {
  a_fazer: ['a fazer', 'prospeccao', 'prospecção'],
  realizada: ['realizada', 'concluido', 'concluído'],
  cancelada: ['cancelada'],
  reagendada: ['reagendada', 'recorrente'],
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Casa um status nosso com uma etapa do painel pelo nome.
 *
 * Devolve null de propósito quando não há correspondência: o painel é
 * configurado por gente, fora do nosso controle, e uma etapa pode
 * simplesmente não existir. Quem chama decide o que fazer — e a resposta
 * certa nunca é impedir o vendedor de trabalhar.
 */
export function etapaParaStatus(etapas: Etapa[], status: string): Etapa | null {
  const aceitos = NOMES[status]
  if (!aceitos) return null

  for (const nome of aceitos) {
    const achada = etapas.find((e) => normalizar(e.titulo) === normalizar(nome))
    if (achada) return achada
  }
  return null
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run tests/visita/etapas.test.ts
```

Esperado: PASSA, 5 casos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/visita/etapas.ts tests/visita/etapas.test.ts
git commit -m "feat(visita): mapa de status para etapa, tolerante ao painel antigo"
```

---

## Task 9: Sincronizador — a cópia que nunca bloqueia

O coração da fatia. Se esta task estiver certa, o erro que originou tudo
("Sem conexão. A visita não foi criada") deixa de ser possível.

**Files:**
- Create: `src/lib/visita/sincronizador.ts`
- Create: `tests/visita/sincronizador.test.ts`

**Interfaces:**
- Consumes: `criarVisita`, `marcarSincronizada`, `BancoVisita` (Tasks 3 e 7); `etapaParaStatus` (Task 8); `criarVisita as criarCardZaple` de `@/lib/zaple/visitas`; `listarEtapas` de `@/lib/zaple/painel`.
- Produces: `sincronizar(db: BancoVisita, v: Visita): Promise<{ ok: boolean; erro?: string }>` — **nunca lança**.

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/visita/sincronizador.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const criarCardZaple = vi.fn()
const moverEtapa = vi.fn()
const listarEtapas = vi.fn()
const gravarNota = vi.fn()

vi.mock('@/lib/zaple/visitas', () => ({
  criarVisita: criarCardZaple,
  moverEtapa,
  listarVisitas: vi.fn(),
  obterVisita: vi.fn(),
  gravarNota,
}))
vi.mock('@/lib/zaple/painel', () => ({ listarEtapas, painelId: () => 'p1' }))

import { criarBancoDeTeste, criarUsuarioDeTeste } from '../apoio/banco'
import { criarVisita, buscarVisita, mudarStatus } from '@/lib/visita/repositorio'
import { sincronizar } from '@/lib/visita/sincronizador'
import { ZapleError } from '@/lib/zaple/erros'

const ETAPAS = [
  { id: 'e1', titulo: 'A fazer', posicao: 1, inicial: true, final: false },
  { id: 'e2', titulo: 'Realizada', posicao: 2, inicial: false, final: false },
]

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>
let usuarioId: string
let zapleUserId: string

beforeEach(async () => {
  banco = await criarBancoDeTeste()
  const u = await criarUsuarioDeTeste(banco.db)
  usuarioId = u.id
  zapleUserId = u.zapleUserId

  criarCardZaple.mockReset()
  criarCardZaple.mockResolvedValue({ id: '44444444-4444-4444-4444-444444444444' })
  moverEtapa.mockReset()
  moverEtapa.mockResolvedValue({})
  gravarNota.mockReset()
  gravarNota.mockResolvedValue({})
  listarEtapas.mockReset()
  listarEtapas.mockResolvedValue(ETAPAS)
})

afterEach(async () => {
  await banco.fechar()
})

function nova() {
  return {
    contatoId: '22222222-2222-2222-2222-222222222222',
    contatoNome: 'AUTOCAR',
    usuarioId,
    zapleUserId,
    data: '2026-08-25',
    titulo: 'AUTOCAR',
  }
}

describe('sincronizar', () => {
  it('cria o card no Zaple e marca a visita como sincronizada', async () => {
    const v = await criarVisita(banco.db, nova())

    const r = await sincronizar(banco.db, v)

    expect(r.ok).toBe(true)
    expect(criarCardZaple).toHaveBeenCalledWith(
      expect.objectContaining({ responsavelId: zapleUserId, contatoIds: [v.contatoId] })
    )
    const depois = await buscarVisita(banco.db, v.id)
    expect(depois?.cardId).toBe('44444444-4444-4444-4444-444444444444')
    expect(depois?.sincronizadoEm).not.toBeNull()
  })

  it('NÃO LANÇA quando o Zaple recusa — é a razão de existir desta fatia', async () => {
    criarCardZaple.mockRejectedValue(
      new ZapleError('FORM_ERROR', 500, 'O responsável informado não foi encontrado.')
    )
    const v = await criarVisita(banco.db, nova())

    const r = await sincronizar(banco.db, v)

    expect(r.ok).toBe(false)
    expect(r.erro).toContain('responsável')
  })

  it('a visita continua existindo depois da falha, e volta para a fila', async () => {
    criarCardZaple.mockRejectedValue(new ZapleError('FORM_ERROR', 500, 'qualquer erro'))
    const v = await criarVisita(banco.db, nova())

    await sincronizar(banco.db, v)

    const depois = await buscarVisita(banco.db, v.id)
    expect(depois).not.toBeNull()
    expect(depois?.sincronizadoEm).toBeNull()
  })

  it('não cria card de novo quando já existe — só move e anota', async () => {
    const v = await criarVisita(banco.db, nova())
    await sincronizar(banco.db, v)
    criarCardZaple.mockClear()

    const realizada = await mudarStatus(banco.db, v.id, 'realizada', 'Fechou negócio')
    await sincronizar(banco.db, realizada!)

    expect(criarCardZaple).not.toHaveBeenCalled()
    expect(moverEtapa).toHaveBeenCalledWith('44444444-4444-4444-4444-444444444444', 'e2')
    expect(gravarNota).toHaveBeenCalledWith(
      '44444444-4444-4444-4444-444444444444',
      expect.stringContaining('Fechou negócio')
    )
  })

  it('não trava quando a etapa não existe no painel — segue sem mover', async () => {
    listarEtapas.mockResolvedValue([ETAPAS[0]]) // sem "Realizada"
    const v = await criarVisita(banco.db, nova())
    await sincronizar(banco.db, v)
    const realizada = await mudarStatus(banco.db, v.id, 'realizada')

    const r = await sincronizar(banco.db, realizada!)

    expect(r.ok).toBe(true)
    expect(moverEtapa).not.toHaveBeenCalled()
  })

  it('não lança nem quando o erro não é do Zaple', async () => {
    criarCardZaple.mockRejectedValue(new Error('rede caiu'))
    const v = await criarVisita(banco.db, nova())

    const r = await sincronizar(banco.db, v)

    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run tests/visita/sincronizador.test.ts
```

Esperado: FALHA — `@/lib/visita/sincronizador` não existe. Pode falhar antes,
em `gravarNota` não exportado de `@/lib/zaple/visitas` — resolvido no passo 3.

- [ ] **Step 3: Garantir que `gravarNota` existe no cliente do Zaple**

Confira se `src/lib/zaple/visitas.ts` já exporta `gravarNota`:

```bash
grep -n "gravarNota" src/lib/zaple/visitas.ts || echo "PRECISA CRIAR"
```

Se imprimir `PRECISA CRIAR`, acrescente ao final de `src/lib/zaple/visitas.ts`:

```ts
/**
 * Grava a nota do relatório no card. É o único jeito de a anotação chegar ao
 * Zaple: verificado em 2026-08-25, não existe endpoint de nota em contato —
 * as quatro variações testadas respondem 404.
 */
export async function gravarNota(cardId: string, texto: string): Promise<void> {
  await zaplePost(`/crm/v1/panel/card/${cardId}/note`, { text: texto })
}
```

- [ ] **Step 4: Implementar o sincronizador**

Crie `src/lib/visita/sincronizador.ts`:

```ts
import { criarVisita as criarCardZaple, moverEtapa, gravarNota } from '@/lib/zaple/visitas'
import { listarEtapas } from '@/lib/zaple/painel'
import { marcarSincronizada, type BancoVisita } from './repositorio'
import { etapaParaStatus } from './etapas'
import type { Visita } from '@/lib/db'

/**
 * Espelha a visita no Zaple. **Nunca lança.**
 *
 * Esta é a inversão inteira em uma função: o dado já está salvo no nosso
 * Postgres quando isto roda. Se o Zaple recusar, estiver fora do ar ou tiver
 * o painel configurado de um jeito que não esperávamos, o resultado é uma
 * visita com `sincronizado_em` nulo — nunca um vendedor na rua sem conseguir
 * registrar o que acabou de fazer.
 */
export async function sincronizar(
  db: BancoVisita,
  v: Visita
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const etapas = await listarEtapas()
    let cardId = v.cardId

    if (!cardId) {
      const etapaInicial = etapaParaStatus(etapas, 'a_fazer') ?? etapas.find((e) => e.inicial)
      if (!etapaInicial) return { ok: false, erro: 'O painel do Zaple não tem etapa inicial.' }

      const card = await criarCardZaple({
        etapaId: etapaInicial.id,
        titulo: v.titulo,
        responsavelId: v.zapleUserId,
        contatoIds: [v.contatoId],
        prazo: undefined,
      })
      cardId = card.id
    }

    if (v.relatorio) await gravarNota(cardId, v.relatorio)

    // A etapa pode não existir: o painel é configurado por gente, e enquanto
    // não for renomeado não há "Cancelada" lá. Não mover é aceitável; travar
    // o sincronismo por causa disso não é.
    //
    // `a_fazer` não move porque o card nasce na etapa inicial — mover para
    // onde ele já está seria uma chamada à toa a cada sincronismo.
    const destino = etapaParaStatus(etapas, v.status)
    if (destino && v.status !== 'a_fazer') {
      await moverEtapa(cardId, destino.id)
    }

    await marcarSincronizada(db, v.id, cardId)
    return { ok: true }
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'Falha ao falar com o Zaple' }
  }
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

```bash
npx vitest run tests/visita/sincronizador.test.ts
```

Esperado: PASSA, 6 casos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/visita/sincronizador.ts src/lib/zaple/visitas.ts tests/visita/sincronizador.test.ts
git commit -m "feat(visita): sincronizador que nunca bloqueia o vendedor"
```

---

## Task 10: Rotas de API sobre o repositório

**Files:**
- Rewrite: `src/app/api/visitas/route.ts`
- Rewrite: `src/app/api/visitas/[id]/route.ts`
- Create: `src/app/api/visitas/[id]/status/route.ts`
- Create: `src/app/api/visitas/[id]/reagendar/route.ts`
- Delete: `src/app/api/visitas/[id]/mover/route.ts`
- Rewrite: `tests/api/criar-visita.test.ts`
- Rewrite: `tests/api/visitas.test.ts`
- Delete: `tests/api/mover.test.ts`

**Interfaces:**
- Consumes: todo o repositório (Tasks 3-7), `sincronizar` (Task 9), `exigirUsuario`.
- Produces: as rotas HTTP que a tela da Task 11 consome.

- [ ] **Step 1: Escrever o teste que falha**

Substitua `tests/api/criar-visita.test.ts` inteiro:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const criarVisitaRepo = vi.fn()
const sincronizar = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/visita/repositorio', () => ({
  criarVisita: criarVisitaRepo,
  listarDoDia: vi.fn(),
  db: {},
}))
vi.mock('@/lib/visita/sincronizador', () => ({ sincronizar }))

const CONTATO = 'c9b9a216-9707-4c45-acca-15fec0486051'

function pedido(corpo: unknown) {
  return new Request('http://local/api/visitas', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/visitas', () => {
  beforeEach(() => {
    exigirUsuario.mockReset()
    exigirUsuario.mockResolvedValue({
      id: 'u1',
      papel: 'vendedor',
      zapleUserId: 'agente-1',
    })
    criarVisitaRepo.mockReset()
    criarVisitaRepo.mockResolvedValue({ id: 'v1', titulo: 'AUTOCAR' })
    sincronizar.mockReset()
    sincronizar.mockResolvedValue({ ok: true })
  })

  it('grava a visita e responde 201', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    const r = await POST(
      pedido({ titulo: 'AUTOCAR', contatoId: CONTATO, contatoNome: 'AUTOCAR', data: '2026-08-25' })
    )

    expect(r.status).toBe(201)
    expect(criarVisitaRepo).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ titulo: 'AUTOCAR', usuarioId: 'u1', zapleUserId: 'agente-1' })
    )
  })

  it('RESPONDE 201 MESMO QUANDO O ZAPLE FALHA — o bug que originou a fatia', async () => {
    sincronizar.mockResolvedValue({ ok: false, erro: 'O responsável não foi encontrado.' })
    const { POST } = await import('@/app/api/visitas/route')

    const r = await POST(
      pedido({ titulo: 'AUTOCAR', contatoId: CONTATO, contatoNome: 'AUTOCAR', data: '2026-08-25' })
    )

    expect(r.status).toBe(201)
  })

  it('recusa visita sem cliente', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    const r = await POST(pedido({ titulo: 'Sem cliente', data: '2026-08-25' }))

    expect(r.status).toBe(400)
    expect(criarVisitaRepo).not.toHaveBeenCalled()
  })

  it('recusa data em formato errado', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    const r = await POST(
      pedido({ titulo: 'X', contatoId: CONTATO, contatoNome: 'X', data: '25/08/2026' })
    )

    expect(r.status).toBe(400)
  })

  it('gestor pode criar visita para outro vendedor', async () => {
    exigirUsuario.mockResolvedValue({ id: 'g1', papel: 'gestor', zapleUserId: 'agente-9' })
    const { POST } = await import('@/app/api/visitas/route')

    await POST(
      pedido({
        titulo: 'X',
        contatoId: CONTATO,
        contatoNome: 'X',
        data: '2026-08-25',
        usuarioId: 'u2',
        zapleUserId: 'agente-2',
      })
    )

    expect(criarVisitaRepo).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ usuarioId: 'u2', zapleUserId: 'agente-2' })
    )
  })

  it('vendedor não consegue criar visita para outro', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    await POST(
      pedido({
        titulo: 'X',
        contatoId: CONTATO,
        contatoNome: 'X',
        data: '2026-08-25',
        usuarioId: 'u2',
        zapleUserId: 'agente-2',
      })
    )

    expect(criarVisitaRepo).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ usuarioId: 'u1', zapleUserId: 'agente-1' })
    )
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run tests/api/criar-visita.test.ts
```

Esperado: FALHA — a rota ainda usa o Zaple.

- [ ] **Step 3: Reescrever `src/app/api/visitas/route.ts`**

```ts
import { z } from 'zod'
import { exigirUsuario } from '@/lib/auth/atual'
import { criarVisita, listarDoDia, db } from '@/lib/visita/repositorio'
import { sincronizar } from '@/lib/visita/sincronizador'

/** 'YYYY-MM-DD'. String, não Date: o fuso não pode mover a visita de dia. */
const DataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser AAAA-MM-DD')

export async function GET(req: Request) {
  const u = await exigirUsuario()
  const url = new URL(req.url)

  const data = url.searchParams.get('data') ?? new Date().toISOString().slice(0, 10)
  const todos = url.searchParams.get('todos') === '1' && u.papel === 'gestor'

  const visitas = await listarDoDia(db, { data, usuarioId: todos ? undefined : u.id })
  return Response.json({ visitas })
}

const NovaEntrada = z.object({
  titulo: z.string().min(1).max(500),
  contatoId: z.guid(),
  contatoNome: z.string().min(1),
  data: DataISO,
  tipo: z.enum(['prospeccao', 'recorrente']).optional(),
  usuarioId: z.uuid().optional(),
  zapleUserId: z.guid().optional(),
})

export async function POST(req: Request) {
  const u = await exigirUsuario()

  const analisado = NovaEntrada.safeParse(await req.json().catch(() => null))
  if (!analisado.success) {
    return Response.json({ erro: 'Informe cliente, título e data' }, { status: 400 })
  }

  // Só o gestor cria visita para outra pessoa.
  const paraOutro = u.papel === 'gestor' && analisado.data.usuarioId && analisado.data.zapleUserId

  const criada = await criarVisita(db, {
    contatoId: analisado.data.contatoId,
    contatoNome: analisado.data.contatoNome,
    usuarioId: paraOutro ? analisado.data.usuarioId! : u.id,
    zapleUserId: paraOutro ? analisado.data.zapleUserId! : u.zapleUserId,
    data: analisado.data.data,
    titulo: analisado.data.titulo,
    tipo: analisado.data.tipo,
  })

  // A visita já existe. O Zaple é cópia: se falhar, `sincronizado_em` fica
  // nulo e o admin reprocessa. O vendedor não fica sabendo, porque para ele
  // não houve erro nenhum.
  await sincronizar(db, criada)

  return Response.json({ visita: criada }, { status: 201 })
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run tests/api/criar-visita.test.ts
```

Esperado: PASSA, 6 casos.

- [ ] **Step 5: Criar a rota de status**

Crie `src/app/api/visitas/[id]/status/route.ts`:

```ts
import { z } from 'zod'
import { exigirUsuario } from '@/lib/auth/atual'
import { buscarVisita, mudarStatus, db } from '@/lib/visita/repositorio'
import { sincronizar } from '@/lib/visita/sincronizador'

const Entrada = z.object({
  status: z.enum(['realizada', 'cancelada']),
  relatorio: z.string().max(5000).optional(),
})

export async function POST(req: Request, { params }: RouteContext<'/api/visitas/[id]/status'>) {
  const u = await exigirUsuario()
  const { id } = await params

  const analisado = Entrada.safeParse(await req.json().catch(() => null))
  if (!analisado.success) return Response.json({ erro: 'Status inválido' }, { status: 400 })

  const atual = await buscarVisita(db, id)
  if (!atual) return Response.json({ erro: 'Visita não encontrada' }, { status: 404 })
  if (u.papel !== 'gestor' && atual.usuarioId !== u.id) {
    return Response.json({ erro: 'Essa visita não é sua' }, { status: 403 })
  }

  const alterada = await mudarStatus(db, id, analisado.data.status, analisado.data.relatorio)
  await sincronizar(db, alterada!)

  return Response.json({ visita: alterada })
}
```

- [ ] **Step 6: Criar a rota de reagendamento**

Crie `src/app/api/visitas/[id]/reagendar/route.ts`:

```ts
import { z } from 'zod'
import { exigirUsuario } from '@/lib/auth/atual'
import { buscarVisita, reagendar, db } from '@/lib/visita/repositorio'
import { sincronizar } from '@/lib/visita/sincronizador'

const Entrada = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser AAAA-MM-DD'),
})

export async function POST(req: Request, { params }: RouteContext<'/api/visitas/[id]/reagendar'>) {
  const u = await exigirUsuario()
  const { id } = await params

  const analisado = Entrada.safeParse(await req.json().catch(() => null))
  if (!analisado.success) return Response.json({ erro: 'Informe a nova data' }, { status: 400 })

  const atual = await buscarVisita(db, id)
  if (!atual) return Response.json({ erro: 'Visita não encontrada' }, { status: 404 })
  if (u.papel !== 'gestor' && atual.usuarioId !== u.id) {
    return Response.json({ erro: 'Essa visita não é sua' }, { status: 403 })
  }

  const r = await reagendar(db, id, analisado.data.data)
  await sincronizar(db, r!.fechada)
  await sincronizar(db, r!.nova)

  return Response.json({ visita: r!.nova }, { status: 201 })
}
```

- [ ] **Step 7: Reescrever o teste da listagem**

Substitua `tests/api/visitas.test.ts` inteiro:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const listarDoDia = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/visita/repositorio', () => ({
  listarDoDia,
  criarVisita: vi.fn(),
  db: {},
}))
vi.mock('@/lib/visita/sincronizador', () => ({ sincronizar: vi.fn() }))

function pedido(query = '') {
  return new Request(`http://local/api/visitas${query}`)
}

describe('GET /api/visitas', () => {
  beforeEach(() => {
    exigirUsuario.mockReset()
    exigirUsuario.mockResolvedValue({ id: 'u1', papel: 'vendedor', zapleUserId: 'agente-1' })
    listarDoDia.mockReset()
    listarDoDia.mockResolvedValue([])
  })

  it('filtra pelo próprio vendedor', async () => {
    const { GET } = await import('@/app/api/visitas/route')

    await GET(pedido('?data=2026-08-25'))

    expect(listarDoDia).toHaveBeenCalledWith(
      expect.anything(),
      { data: '2026-08-25', usuarioId: 'u1' }
    )
  })

  it('gestor com todos=1 vê a agenda inteira', async () => {
    exigirUsuario.mockResolvedValue({ id: 'g1', papel: 'gestor', zapleUserId: 'agente-9' })
    const { GET } = await import('@/app/api/visitas/route')

    await GET(pedido('?data=2026-08-25&todos=1'))

    expect(listarDoDia).toHaveBeenCalledWith(
      expect.anything(),
      { data: '2026-08-25', usuarioId: undefined }
    )
  })

  it('vendedor que force todos=1 continua vendo só as próprias', async () => {
    const { GET } = await import('@/app/api/visitas/route')

    await GET(pedido('?data=2026-08-25&todos=1'))

    expect(listarDoDia).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ usuarioId: 'u1' })
    )
  })

  it('sem data na query, usa hoje', async () => {
    const { GET } = await import('@/app/api/visitas/route')

    await GET(pedido())

    const hoje = new Date().toISOString().slice(0, 10)
    expect(listarDoDia).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: hoje })
    )
  })
})
```

- [ ] **Step 8: Reescrever a rota de detalhe da visita**

Substitua `src/app/api/visitas/[id]/route.ts` inteiro — ela lia do Zaple:

```ts
import { exigirUsuario } from '@/lib/auth/atual'
import { buscarVisita, db } from '@/lib/visita/repositorio'

export async function GET(_req: Request, { params }: RouteContext<'/api/visitas/[id]'>) {
  const u = await exigirUsuario()
  const { id } = await params

  const visita = await buscarVisita(db, id)
  if (!visita) return Response.json({ erro: 'Visita não encontrada' }, { status: 404 })

  if (u.papel !== 'gestor' && visita.usuarioId !== u.id) {
    return Response.json({ erro: 'Essa visita não é sua' }, { status: 403 })
  }

  return Response.json({ visita })
}
```

Note que o dono passa a ser comparado por `usuarioId` (nosso), não por
`zapleUserId` — a visita agora é nossa, e o vínculo com o Zaple só importa
para o card espelho.

- [ ] **Step 9: Reescrever o teste do detalhe**

Substitua `tests/api/visita-detalhe.test.ts` inteiro:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const buscarVisita = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/visita/repositorio', () => ({ buscarVisita, db: {} }))

const params = Promise.resolve({ id: 'v1' })

describe('GET /api/visitas/[id]', () => {
  beforeEach(() => {
    exigirUsuario.mockReset()
    exigirUsuario.mockResolvedValue({ id: 'u1', papel: 'vendedor', zapleUserId: 'agente-1' })
    buscarVisita.mockReset()
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u1', titulo: 'AUTOCAR' })
  })

  it('devolve a visita do próprio vendedor', async () => {
    const { GET } = await import('@/app/api/visitas/[id]/route')

    const r = await GET(new Request('http://local'), { params })

    expect(r.status).toBe(200)
  })

  it('404 quando a visita não existe', async () => {
    buscarVisita.mockResolvedValue(null)
    const { GET } = await import('@/app/api/visitas/[id]/route')

    const r = await GET(new Request('http://local'), { params })

    expect(r.status).toBe(404)
  })

  it('403 na visita de outro vendedor', async () => {
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u2' })
    const { GET } = await import('@/app/api/visitas/[id]/route')

    const r = await GET(new Request('http://local'), { params })

    expect(r.status).toBe(403)
  })

  it('gestor enxerga visita de qualquer um', async () => {
    exigirUsuario.mockResolvedValue({ id: 'g1', papel: 'gestor', zapleUserId: 'agente-9' })
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u2' })
    const { GET } = await import('@/app/api/visitas/[id]/route')

    const r = await GET(new Request('http://local'), { params })

    expect(r.status).toBe(200)
  })
})
```

- [ ] **Step 10: Ajustar a página de detalhe**

`src/app/(app)/visita/[id]/page.tsx` hoje chama `obterVisita()` do Zaple e
trata `ZapleError` com `notFound()`. Leia o arquivo e troque a origem do dado:

```bash
cat "src/app/(app)/visita/[id]/page.tsx"
```

A troca é: `obterVisita(id)` vira `buscarVisita(db, id)`, e o `catch` com
`ZapleError` some — `buscarVisita` devolve `null` em vez de lançar, então o
tratamento vira `if (!visita) notFound()`. Os campos exibidos passam a vir da
nossa tabela: `contatoNome` no lugar de `contatos[0].nome`, `status` no lugar
de `etapaTitulo`, `data` no lugar de `prazo`.

- [ ] **Step 11: Apagar o que morreu**

```bash
rm -rf "src/app/api/visitas/[id]/mover" tests/api/mover.test.ts
```

- [ ] **Step 12: Suíte inteira verde**

```bash
npx next typegen && npx tsc --noEmit && npm test 2>&1 | tail -10
```

Esperado: `tsc` limpo e todos os testes passando. O `typegen` é necessário
porque as rotas mudaram — sem ele, `RouteContext<'/api/visitas/[id]/status'>`
não existe ainda e o `tsc` acusa.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(api): rotas de visita sobre o Postgres, com sincronismo não-bloqueante"
```

---

## Task 11: Tela de agenda, sem tratamento visual

O visual inteiro é a Fatia B. Esta task entrega a **estrutura funcional**:
seções por status, um toque para concluir. Feio de propósito — estilizar aqui
seria trabalho jogado fora daqui a uma semana.

**Files:**
- Create: `src/app/(app)/agenda/page.tsx`
- Create: `src/app/(app)/agenda/ListaDoDia.tsx`
- Modify: `src/app/(app)/layout.tsx` (o link do cabeçalho aponta para `/agenda`)
- Modify: `src/app/page.tsx` (redireciona para `/agenda` em vez de `/kanban`)

**Interfaces:**
- Consumes: `listarDoDia`, `db` (Task 4); as rotas da Task 10.
- Produces: a rota `/agenda`.

- [ ] **Step 1: Criar a página**

```tsx
import Link from 'next/link'
import { exigirUsuario } from '@/lib/auth/atual'
import { listarDoDia, db } from '@/lib/visita/repositorio'
import { ListaDoDia } from './ListaDoDia'

export const dynamic = 'force-dynamic'

export default async function Agenda({ searchParams }: PageProps<'/agenda'>) {
  const u = await exigirUsuario()
  const { data, todos } = await searchParams

  const dia = typeof data === 'string' ? data : new Date().toISOString().slice(0, 10)
  const vendoTodos = todos === '1' && u.papel === 'gestor'

  const visitas = await listarDoDia(db, { data: dia, usuarioId: vendoTodos ? undefined : u.id })

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">{dia}</h1>
        {u.papel === 'gestor' && (
          <Link
            href={vendoTodos ? '/agenda' : '/agenda?todos=1'}
            className="text-sm text-slate-600 underline"
          >
            {vendoTodos ? 'Ver só as minhas' : 'Ver todos'}
          </Link>
        )}
        <Link href="/visita/nova" className="ml-auto rounded bg-slate-900 px-3 py-2 text-sm text-white">
          Nova visita
        </Link>
      </div>

      <ListaDoDia visitas={visitas} />
    </div>
  )
}
```

- [ ] **Step 2: Criar a lista**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { erroDaResposta } from '@/lib/api/cliente'
import type { Visita } from '@/lib/db'

const SECOES = [
  { status: 'a_fazer', titulo: 'A fazer' },
  { status: 'realizada', titulo: 'Realizadas' },
  { status: 'cancelada', titulo: 'Canceladas' },
  { status: 'reagendada', titulo: 'Reagendadas' },
] as const

export function ListaDoDia({ visitas }: { visitas: Visita[] }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [ocupada, setOcupada] = useState<string | null>(null)

  async function concluir(v: Visita, status: 'realizada' | 'cancelada') {
    setOcupada(v.id)
    setErro(null)
    try {
      const r = await fetch(`/api/visitas/${v.id}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível atualizar a visita'))
        return
      }
      router.refresh()
    } catch {
      setErro('Sem conexão. A visita não foi atualizada.')
    } finally {
      setOcupada(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      )}

      {SECOES.map((secao) => {
        const daSecao = visitas.filter((v) => v.status === secao.status)
        if (daSecao.length === 0 && secao.status !== 'a_fazer') return null

        return (
          <section key={secao.status} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-slate-600">
              {secao.titulo} ({daSecao.length})
            </h2>

            {daSecao.length === 0 && (
              <p className="text-sm text-slate-400">Nenhuma visita.</p>
            )}

            {daSecao.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-medium">{v.contatoNome}</p>
                  <p className="text-sm text-slate-500">
                    {v.tipo === 'recorrente' ? 'Recorrente' : 'Prospecção'}
                  </p>
                </div>

                {v.status === 'a_fazer' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => concluir(v, 'realizada')}
                      disabled={ocupada === v.id}
                      className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Realizada
                    </button>
                    <button
                      onClick={() => concluir(v, 'cancelada')}
                      disabled={ocupada === v.id}
                      className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Redirecionar as entradas antigas**

Em `src/app/(app)/layout.tsx`, troque `href="/kanban"` por `href="/agenda"`.

Em `src/app/page.tsx`, troque o destino do redirecionamento de `/kanban` para
`/agenda`. Confirme o conteúdo atual antes de editar:

```bash
cat src/app/page.tsx
```

- [ ] **Step 4: Verificar no navegador**

```bash
npm run dev
```

Entre com um gestor, crie uma visita e confirme: ela aparece em "A fazer",
o botão "Realizada" move o item para a seção certa, e o Zaple recebe o card.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(agenda): tela de agenda por data, sem tratamento visual"
```

---

## Task 12: Remover o kanban

Só agora, com a agenda funcionando: apagar antes deixaria o app sem tela.

**Files:**
- Delete: `src/app/(app)/kanban/` (4 arquivos)
- Delete: `src/lib/visita/regras.ts`
- Delete: `tests/visita/regras.test.ts`

- [ ] **Step 1: Confirmar que ninguém mais usa**

```bash
grep -rn "kanban\|proximaEtapa\|podeMover" src/ tests/ --include=*.ts --include=*.tsx
```

Esperado: nenhuma ocorrência fora dos próprios arquivos a apagar. **Se
aparecer alguma, corrija antes de apagar.**

- [ ] **Step 2: Apagar**

```bash
rm -rf "src/app/(app)/kanban" src/lib/visita/regras.ts tests/visita/regras.test.ts
```

- [ ] **Step 3: Verificar que nada quebrou**

```bash
npx next typegen && npx tsc --noEmit && npm test 2>&1 | tail -10 && npm run build 2>&1 | tail -20
```

Esperado: `tsc` limpo, testes verdes, build listando `/agenda` e **sem**
`/kanban`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remover o kanban, substituído pela agenda"
```

---

## Task 13: Admin — reprocessar sincronismo pendente

Fecha o ciclo: sem isto, a visita que falhou ao sincronizar fica invisível.

**Files:**
- Create: `src/app/api/sincronismo/route.ts`
- Modify: `src/app/(app)/admin/page.tsx`
- Create: `src/app/(app)/admin/Pendentes.tsx`
- Create: `tests/api/sincronismo.test.ts`

**Interfaces:**
- Consumes: `listarNaoSincronizadas` (Task 7), `sincronizar` (Task 9), `exigirGestor`.
- Produces: `GET /api/sincronismo` (lista) e `POST /api/sincronismo` (reprocessa todas).

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirGestor = vi.fn()
const listarNaoSincronizadas = vi.fn()
const sincronizar = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirGestor, exigirUsuario: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/visita/repositorio', () => ({ listarNaoSincronizadas, db: {} }))
vi.mock('@/lib/visita/sincronizador', () => ({ sincronizar }))

describe('/api/sincronismo', () => {
  beforeEach(() => {
    exigirGestor.mockReset()
    exigirGestor.mockResolvedValue({ id: 'g1', papel: 'gestor' })
    listarNaoSincronizadas.mockReset()
    listarNaoSincronizadas.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }])
    sincronizar.mockReset()
    sincronizar.mockResolvedValue({ ok: true })
  })

  it('lista as visitas que não chegaram ao Zaple', async () => {
    const { GET } = await import('@/app/api/sincronismo/route')

    const r = await GET()

    expect((await r.json()).pendentes).toHaveLength(2)
  })

  it('reprocessa todas e conta os sucessos', async () => {
    sincronizar.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, erro: 'x' })
    const { POST } = await import('@/app/api/sincronismo/route')

    const corpo = await (await POST()).json()

    expect(corpo).toEqual({ tentadas: 2, sincronizadas: 1 })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run tests/api/sincronismo.test.ts
```

Esperado: FALHA — módulo não existe.

- [ ] **Step 3: Implementar a rota**

```ts
import { exigirGestor } from '@/lib/auth/atual'
import { listarNaoSincronizadas, db } from '@/lib/visita/repositorio'
import { sincronizar } from '@/lib/visita/sincronizador'

export async function GET() {
  await exigirGestor()
  return Response.json({ pendentes: await listarNaoSincronizadas(db) })
}

/**
 * Reprocessa a fila inteira. Sem agendador e sem backoff de propósito: com o
 * volume de hoje, um botão no admin resolve, e um processo de fundo seria
 * infraestrutura para um problema que ainda não existe.
 */
export async function POST() {
  await exigirGestor()
  const pendentes = await listarNaoSincronizadas(db)

  let sincronizadas = 0
  for (const v of pendentes) {
    const r = await sincronizar(db, v)
    if (r.ok) sincronizadas++
  }

  return Response.json({ tentadas: pendentes.length, sincronizadas })
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run tests/api/sincronismo.test.ts
```

Esperado: PASSA, 2 casos.

- [ ] **Step 5: Adicionar a seção no admin**

Crie `src/app/(app)/admin/Pendentes.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { erroDaResposta } from '@/lib/api/cliente'

export function Pendentes({ quantidade }: { quantidade: number }) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)

  async function reprocessar() {
    setOcupado(true)
    setErro(null)
    try {
      const r = await fetch('/api/sincronismo', { method: 'POST' })
      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível reprocessar'))
        return
      }
      const { tentadas, sincronizadas } = await r.json()
      setResultado(`${sincronizadas} de ${tentadas} foram para o Zaple.`)
      router.refresh()
    } catch {
      setErro('Sem conexão. Nada foi reprocessado.')
    } finally {
      setOcupado(false)
    }
  }

  if (quantidade === 0) return null

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm">
        <strong>{quantidade}</strong>{' '}
        {quantidade === 1 ? 'visita não chegou' : 'visitas não chegaram'} ao Zaple. Elas estão
        salvas aqui e o vendedor não foi afetado.
      </p>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {resultado && <p className="text-sm text-slate-700">{resultado}</p>}
      <button
        onClick={reprocessar}
        disabled={ocupado}
        className="self-start rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {ocupado ? 'Enviando…' : 'Tentar de novo'}
      </button>
    </section>
  )
}
```

Em `src/app/(app)/admin/page.tsx`, carregue a contagem e renderize o
componente acima do conteúdo existente:

```tsx
import { listarNaoSincronizadas, db } from '@/lib/visita/repositorio'
import { Pendentes } from './Pendentes'
```

```tsx
const pendentes = await listarNaoSincronizadas(db)
```

```tsx
<Pendentes quantidade={pendentes.length} />
```

- [ ] **Step 6: Verificação final da fatia**

```bash
npx next typegen && npx tsc --noEmit && npm test 2>&1 | tail -10 && npm run build 2>&1 | tail -25
```

Esperado: tudo verde, build com `/agenda` e `/api/sincronismo`, sem `/kanban`
e sem `/api/visitas/[id]/mover`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(admin): reprocessar visitas não sincronizadas"
```

---

## Verificação de aceitação da Fatia A

Ao final, estes fatos devem ser demonstráveis — não presumidos:

- [ ] Criar visita com o Zaple fora do ar **funciona**, e a visita aparece na agenda.
- [ ] A visita fica listada no admin como pendente, e o botão a envia quando o Zaple volta.
- [ ] Marcar realizada muda a seção na tela e grava a nota no card do Zaple.
- [ ] Reagendar produz duas linhas: a original `reagendada` e a nova `a_fazer` na data escolhida.
- [ ] Vendedor não enxerga nem altera visita de outro vendedor.
- [ ] `/kanban` não existe mais; `/agenda` é a tela do vendedor.
- [ ] `npx tsc --noEmit` limpo, `npm test` verde, `npm run build` sem erro.

Para testar o primeiro item sem derrubar nada: troque `ZAPLE_TOKEN` por um
valor inválido no `.env`, reinicie o `dev`, e crie uma visita.
