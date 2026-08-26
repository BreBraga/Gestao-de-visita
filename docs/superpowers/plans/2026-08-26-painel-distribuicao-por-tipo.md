# Painel — distribuição por tipo de visita

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar no `/painel` para onde foi o esforço da equipe no período — a distribuição das visitas realizadas por tipo — no total e, sob demanda, por vendedor.

**Architecture:** Uma consulta nova no repositório devolve as contagens cruas; uma função pura as transforma em fatias ordenadas com percentual; um componente de apresentação desenha as barras horizontais nos dois níveis. O card do vendedor vira Client Component só para guardar o estado de aberto/fechado — a página continua Server Component buscando tudo no servidor.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · Drizzle ORM · Tailwind v4 · Vitest · PGlite (Postgres em memória nos testes)

**Spec:** [`docs/superpowers/specs/2026-08-26-painel-distribuicao-por-tipo-design.md`](../specs/2026-08-26-painel-distribuicao-por-tipo-design.md)

---

## Global Constraints

- **Só visitas com `status = 'realizada'`** entram na conta. Agendada e cancelada não gerou nada.
- **Só visitas de `usuario.papel = 'vendedor'`**, igual ao que `resumoPorVendedor` já faz. Visita de gestor não é produtividade de vendedor.
- **`recorrente` soma dentro de `manutencao`.** É o nome antigo do mesmo tipo. A fusão sai de `rotuloDoTipo()` em `@/lib/visita/tipos`, que já mapeia os dois para "Manutenção" — não reimplemente a regra.
- **Uma cor para todas as barras: `#7c3aed`**, token `--color-tipo`. Tipo é categoria nominal e cada barra já tem rótulo e comprimento; cinco cores seriam decoração. Validado: ΔE 9.2 sob daltonismo contra as quatro cores de status, 5.70:1 de contraste no card branco.
- **Nunca use as cores de status** (`fazer`, `feita`, `adiada`, `morta`) para tipo. São dimensões diferentes, e o leitor acabou de aprender o código de status na seção acima.
- **A largura da barra é o percentual do total**, não normalizada pela maior fatia. Se a barra de 40% ocupasse a largura toda, o número e o desenho se contradiriam.
- **Alvo de toque mínimo de 44px**, como todo elemento clicável deste app.
- **Ordenação determinística:** total decrescente, empate desfeito por rótulo em ordem alfabética. Sem isso o teste fica instável e a tela "pula" entre recargas.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/visita/painel-tipos.ts` | **Criar.** Tipos `ContagemTipo` e `FatiaTipo`, e a função pura `fatiasPorTipo`. Sem SQL, sem React. |
| `src/lib/visita/repositorio.ts` | **Modificar.** Ganha `contagemPorTipo`. Nada existente muda. |
| `src/app/globals.css` | **Modificar.** Ganha o token `--color-tipo`. |
| `src/app/(app)/painel/BarrasPorTipo.tsx` | **Criar.** Desenha as barras. Recebe fatias prontas; não sabe de onde vêm. |
| `src/app/(app)/painel/CardVendedor.tsx` | **Criar.** O card do vendedor, agora Client Component com expansão. Absorve o `<article>` e o helper `Faixa` que hoje estão inline na página. |
| `src/app/(app)/painel/page.tsx` | **Modificar.** Busca a contagem, monta a seção da equipe, delega o card. |
| `tests/visita/painel-tipos.test.ts` | **Criar.** A função pura. |
| `tests/visita/repositorio-tipos.test.ts` | **Criar.** A consulta, contra o Postgres em memória. |

`src/lib/visita/tipos.ts` **não muda.** Não há cor por tipo para guardar lá.

---

## Task 1: A função pura de agregação

**Files:**
- Create: `src/lib/visita/painel-tipos.ts`
- Test: `tests/visita/painel-tipos.test.ts`

**Interfaces:**
- Consumes: `rotuloDoTipo(tipo: string): string` de `@/lib/visita/tipos`
- Produces:
  - `type ContagemTipo = { tipo: string; usuarioId: string; total: number }`
  - `type FatiaTipo = { rotulo: string; total: number; percentual: number }`
  - `fatiasPorTipo(contagens: ContagemTipo[]): FatiaTipo[]`

- [ ] **Step 1: Escrever o teste**

`tests/visita/painel-tipos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fatiasPorTipo, type ContagemTipo } from '@/lib/visita/painel-tipos'

const U1 = 'aaaaaaaa-0000-0000-0000-000000000001'
const U2 = 'aaaaaaaa-0000-0000-0000-000000000002'

function c(tipo: string, total: number, usuarioId = U1): ContagemTipo {
  return { tipo, usuarioId, total }
}

describe('fatiasPorTipo', () => {
  it('soma as contagens e calcula o percentual sobre o total', () => {
    const fatias = fatiasPorTipo([c('prospeccao', 6), c('pedido', 4)])

    expect(fatias).toEqual([
      { rotulo: 'Prospecção', total: 6, percentual: 60 },
      { rotulo: 'Pedido', total: 4, percentual: 40 },
    ])
  })

  it('soma linhas do mesmo tipo vindas de vendedores diferentes', () => {
    const fatias = fatiasPorTipo([c('pedido', 3, U1), c('pedido', 2, U2)])

    expect(fatias).toEqual([{ rotulo: 'Pedido', total: 5, percentual: 100 }])
  })

  it('funde recorrente dentro de manutenção', () => {
    // `recorrente` é o nome antigo do mesmo tipo e ainda existe em linhas
    // gravadas. Sem a fusão, "Manutenção" apareceria duas vezes no gráfico.
    const fatias = fatiasPorTipo([c('manutencao', 3), c('recorrente', 2)])

    expect(fatias).toEqual([{ rotulo: 'Manutenção', total: 5, percentual: 100 }])
  })

  it('ordena da maior fatia para a menor', () => {
    const fatias = fatiasPorTipo([c('outro', 1), c('prospeccao', 9), c('entrega', 5)])

    expect(fatias.map((f) => f.rotulo)).toEqual(['Prospecção', 'Entrega', 'Outro'])
  })

  it('desempata pelo rótulo, para a tela não pular entre recargas', () => {
    const fatias = fatiasPorTipo([c('pedido', 4), c('entrega', 4), c('outro', 4)])

    expect(fatias.map((f) => f.rotulo)).toEqual(['Entrega', 'Outro', 'Pedido'])
  })

  it('omite tipos sem visita em vez de mostrar barra zerada', () => {
    const fatias = fatiasPorTipo([c('prospeccao', 3), c('entrega', 0)])

    expect(fatias.map((f) => f.rotulo)).toEqual(['Prospecção'])
  })

  it('devolve lista vazia quando não há nada no período', () => {
    expect(fatiasPorTipo([])).toEqual([])
  })

  it('não divide por zero quando todas as contagens são zero', () => {
    expect(fatiasPorTipo([c('prospeccao', 0)])).toEqual([])
  })

  it('arredonda o percentual, aceitando que a soma não dê exatamente 100', () => {
    // Três fatias iguais dão 33% cada e somam 99. O percentual é exibido por
    // fatia, sem total na tela, então ninguém confronta a soma — mas o teste
    // fixa o comportamento para que ninguém "conserte" isso distribuindo sobra.
    const fatias = fatiasPorTipo([c('pedido', 1), c('entrega', 1), c('outro', 1)])

    expect(fatias.map((f) => f.percentual)).toEqual([33, 33, 33])
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/visita/painel-tipos.test.ts`
Expected: FAIL — `Cannot find package '@/lib/visita/painel-tipos'`

- [ ] **Step 3: Implementar**

`src/lib/visita/painel-tipos.ts`:

```ts
import { rotuloDoTipo } from './tipos'

/** Uma linha crua do banco: quantas visitas de um tipo um vendedor realizou. */
export type ContagemTipo = {
  tipo: string
  usuarioId: string
  total: number
}

/** Uma barra pronta para desenhar. */
export type FatiaTipo = {
  rotulo: string
  total: number
  /** Inteiro de 0 a 100. É também a largura da barra. */
  percentual: number
}

/**
 * Agrupa as contagens pelo rótulo do tipo e devolve as fatias ordenadas.
 *
 * Agrupar pelo RÓTULO, e não pelo valor do enum, é o que funde `recorrente`
 * dentro de `manutencao` sem repetir a regra aqui: `rotuloDoTipo` já devolve
 * "Manutenção" para os dois.
 *
 * Para o recorte de um vendedor, filtre as contagens por `usuarioId` antes de
 * chamar — a função não conhece o conceito de vendedor.
 */
export function fatiasPorTipo(contagens: ContagemTipo[]): FatiaTipo[] {
  const porRotulo = new Map<string, number>()

  for (const c of contagens) {
    if (c.total <= 0) continue
    const rotulo = rotuloDoTipo(c.tipo)
    porRotulo.set(rotulo, (porRotulo.get(rotulo) ?? 0) + c.total)
  }

  const total = [...porRotulo.values()].reduce((soma, n) => soma + n, 0)
  if (total === 0) return []

  return [...porRotulo.entries()]
    .map(([rotulo, n]) => ({
      rotulo,
      total: n,
      percentual: Math.round((n / total) * 100),
    }))
    // Empate desfeito pelo rótulo: sem isso a ordem depende da inserção no Map
    // e a tela reordena sozinha entre recargas.
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/visita/painel-tipos.test.ts`
Expected: PASS — 9 testes

- [ ] **Step 5: Commit**

```bash
git add src/lib/visita/painel-tipos.ts tests/visita/painel-tipos.test.ts
git commit -m "feat(painel): agregação das visitas realizadas por tipo"
```

---

## Task 2: A consulta no repositório

**Files:**
- Modify: `src/lib/visita/repositorio.ts` (acrescentar ao final)
- Test: `tests/visita/repositorio-tipos.test.ts`

**Interfaces:**
- Consumes: `BancoVisita`, `visita`, `usuario` (já no arquivo); `type ContagemTipo` de `@/lib/visita/painel-tipos` (Task 1)
- Produces: `contagemPorTipo(db: BancoVisita, de: string, ate: string): Promise<ContagemTipo[]>`

- [ ] **Step 1: Escrever o teste**

`tests/visita/repositorio-tipos.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { criarBancoDeTeste, criarUsuarioDeTeste } from '../apoio/banco'
import { criarVisita, contagemPorTipo } from '@/lib/visita/repositorio'
import { usuario, visita } from '@/lib/db/schema'

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

/**
 * Cria a visita e a marca como realizada direto no banco.
 *
 * Vai pelo UPDATE e não por `mudarStatus` de propósito: `mudarStatus` exige
 * relatório e dispara o sincronismo com o Zaple, e este teste é sobre a
 * consulta, não sobre a regra de transição.
 */
async function visitaRealizada(
  tipo: string,
  data = '2026-08-20',
  dono: { usuarioId: string; zapleUserId: string } = { usuarioId, zapleUserId }
) {
  const v = await criarVisita(banco.db, {
    contatoId: CONTATO,
    contatoNome: 'AUTOCAR',
    usuarioId: dono.usuarioId,
    zapleUserId: dono.zapleUserId,
    data,
    titulo: 'AUTOCAR',
    tipo: tipo as never,
  })
  await banco.db.update(visita).set({ status: 'realizada' }).where(eq(visita.id, v.id))
  return v
}

describe('contagemPorTipo', () => {
  it('conta as visitas realizadas agrupadas por tipo', async () => {
    await visitaRealizada('prospeccao')
    await visitaRealizada('prospeccao')
    await visitaRealizada('pedido')

    const linhas = await contagemPorTipo(banco.db, '2026-08-01', '2026-08-31')

    const porTipo = Object.fromEntries(linhas.map((l) => [l.tipo, l.total]))
    expect(porTipo).toEqual({ prospeccao: 2, pedido: 1 })
  })

  it('devolve o usuarioId, para o recorte por vendedor', async () => {
    await visitaRealizada('pedido')

    const linhas = await contagemPorTipo(banco.db, '2026-08-01', '2026-08-31')

    expect(linhas[0].usuarioId).toBe(usuarioId)
  })

  it('ignora visitas que não foram realizadas', async () => {
    // criarVisita nasce com status 'a_fazer'.
    await criarVisita(banco.db, {
      contatoId: CONTATO,
      contatoNome: 'AUTOCAR',
      usuarioId,
      zapleUserId,
      data: '2026-08-20',
      titulo: 'AUTOCAR',
      tipo: 'prospeccao',
    })

    expect(await contagemPorTipo(banco.db, '2026-08-01', '2026-08-31')).toEqual([])
  })

  it('ignora visitas fora do período', async () => {
    await visitaRealizada('pedido', '2026-07-15')

    expect(await contagemPorTipo(banco.db, '2026-08-01', '2026-08-31')).toEqual([])
  })

  it('inclui os extremos do período', async () => {
    await visitaRealizada('pedido', '2026-08-01')
    await visitaRealizada('entrega', '2026-08-31')

    const linhas = await contagemPorTipo(banco.db, '2026-08-01', '2026-08-31')

    expect(linhas).toHaveLength(2)
  })

  it('ignora visitas de gestor, como o resumo por vendedor já faz', async () => {
    // Uma visita que um gestor fez para acompanhar a equipe não é
    // produtividade de vendedor, e contá-la infla quem administra o sistema.
    const gestor = await criarUsuarioDeTeste(banco.db, '33333333-3333-3333-3333-333333333333')
    await banco.db.update(usuario).set({ papel: 'gestor' }).where(eq(usuario.id, gestor.id))

    await visitaRealizada('pedido', '2026-08-20', {
      usuarioId: gestor.id,
      zapleUserId: gestor.zapleUserId,
    })

    expect(await contagemPorTipo(banco.db, '2026-08-01', '2026-08-31')).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/visita/repositorio-tipos.test.ts`
Expected: FAIL — `contagemPorTipo is not a function`

- [ ] **Step 3: Implementar**

Acrescentar ao final de `src/lib/visita/repositorio.ts`:

```ts
/**
 * Quantas visitas realizadas de cada tipo, por vendedor, no período.
 *
 * O recorte por `papel = 'vendedor'` acompanha `resumoPorVendedor`: assim as
 * duas seções do painel falam do mesmo conjunto de pessoas e não divergem.
 *
 * O índice `idx_visita_data_status` cobre o filtro de data e status.
 */
export async function contagemPorTipo(
  db: BancoVisita,
  de: string,
  ate: string
): Promise<ContagemTipo[]> {
  return db
    .select({
      tipo: visita.tipo,
      usuarioId: visita.usuarioId,
      total: count(),
    })
    .from(visita)
    .innerJoin(usuario, eq(usuario.id, visita.usuarioId))
    .where(
      and(
        eq(visita.status, 'realizada'),
        gte(visita.data, de),
        lte(visita.data, ate),
        eq(usuario.papel, 'vendedor')
      )
    )
    .groupBy(visita.tipo, visita.usuarioId)
}
```

E acrescentar ao bloco de imports no topo do arquivo:

```ts
import type { ContagemTipo } from './painel-tipos'
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/visita/repositorio-tipos.test.ts`
Expected: PASS — 6 testes

- [ ] **Step 5: Commit**

```bash
git add src/lib/visita/repositorio.ts tests/visita/repositorio-tipos.test.ts
git commit -m "feat(painel): consulta de visitas realizadas por tipo"
```

---

## Task 3: O token de cor e o componente das barras

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/app/(app)/painel/BarrasPorTipo.tsx`

**Interfaces:**
- Consumes: `type FatiaTipo` de `@/lib/visita/painel-tipos` (Task 1)
- Produces: `<BarrasPorTipo fatias={FatiaTipo[]} compacto?={boolean} />` — não renderiza nada se `fatias` estiver vazio

- [ ] **Step 1: Acrescentar o token de cor**

Em `src/app/globals.css`, dentro do bloco `@theme`, logo depois de `--color-morta`:

```css
  /* Tipo de visita. UMA cor para todas as barras, não uma por tipo: a barra já
     traz o rótulo ao lado e o comprimento proporcional, então cor por tipo
     gastaria o canal de identidade repetindo o que o comprimento já diz.

     Violeta porque o espaço de matiz aqui é apertado: azul, verde e amarelo
     são os status acima, e confundir "prospecção" com "a fazer" na mesma tela
     seria um erro de leitura, não de estética. Verificado: ΔE 9.2 sob
     daltonismo contra as quatro cores de status, 5.70:1 de contraste sobre o
     card branco — mais legível que `adiada` e `morta`, que já estão em uso. */
  --color-tipo: #7c3aed;
```

- [ ] **Step 2: Implementar o componente**

`src/app/(app)/painel/BarrasPorTipo.tsx`:

```tsx
import type { FatiaTipo } from '@/lib/visita/painel-tipos'

/**
 * Barras horizontais, uma por tipo.
 *
 * A largura é o percentual do total, não o tamanho relativo à maior fatia: se
 * a barra de 40% ocupasse a largura toda, o desenho contradiria o número
 * impresso ao lado dele.
 *
 * Sem legenda de propósito — é uma cor só, e cada barra se identifica pelo
 * próprio rótulo.
 */
export function BarrasPorTipo({
  fatias,
  compacto = false,
}: {
  fatias: FatiaTipo[]
  compacto?: boolean
}) {
  if (fatias.length === 0) return null

  return (
    <ul className={compacto ? 'flex flex-col gap-1.5' : 'flex flex-col gap-2.5'}>
      {fatias.map((f) => (
        <li key={f.rotulo} className="flex items-center gap-3">
          <span
            className={`shrink-0 ${compacto ? 'w-20 text-xs' : 'w-24 text-sm'} truncate text-slate-600`}
          >
            {f.rotulo}
          </span>

          <div
            className={`flex-1 overflow-hidden rounded-full bg-slate-100 ${compacto ? 'h-1.5' : 'h-2.5'}`}
          >
            <div className="h-full rounded-full bg-tipo" style={{ width: `${f.percentual}%` }} />
          </div>

          <span
            className={`shrink-0 text-right tabular-nums text-slate-500 ${
              compacto ? 'w-14 text-xs' : 'w-16 text-sm'
            }`}
          >
            <span className="font-display font-semibold text-slate-800">{f.total}</span>{' '}
            {f.percentual}%
          </span>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Conferir que o token compila**

Run: `npm run build`
Expected: `✓ Compiled successfully` — se `bg-tipo` não existisse como classe, o Tailwind a ignoraria em silêncio e a barra sairia transparente, então confira no navegador na Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css "src/app/(app)/painel/BarrasPorTipo.tsx"
git commit -m "feat(painel): token de cor e componente de barras por tipo"
```

---

## Task 4: A seção da equipe no painel

**Files:**
- Modify: `src/app/(app)/painel/page.tsx`

**Interfaces:**
- Consumes: `contagemPorTipo` (Task 2), `fatiasPorTipo` (Task 1), `<BarrasPorTipo>` (Task 3)
- Produces: a seção "Por tipo" renderizada entre a taxa de conclusão e o "Por vendedor"

- [ ] **Step 1: Buscar a contagem junto com o resto**

Em `src/app/(app)/painel/page.tsx`, trocar o bloco que busca os dados:

```tsx
  const [linhas, pendentes, contagens] = await Promise.all([
    resumoPorVendedor(db, de, ate),
    listarNaoSincronizadas(db),
    contagemPorTipo(db, de, ate),
  ])

  const fatiasDaEquipe = fatiasPorTipo(contagens)
```

E acrescentar aos imports do topo:

```tsx
import { resumoPorVendedor, listarNaoSincronizadas, contagemPorTipo, db } from '@/lib/visita/repositorio'
import { fatiasPorTipo } from '@/lib/visita/painel-tipos'
import { BarrasPorTipo } from './BarrasPorTipo'
```

(o import de `resumoPorVendedor`/`listarNaoSincronizadas`/`db` já existe — acrescente `contagemPorTipo` a ele em vez de criar outra linha)

- [ ] **Step 2: Inserir a seção**

Logo **depois** do bloco `{fechadas > 0 && ( … Taxa de conclusão … )}` e **antes** da seção "Por vendedor":

```tsx
      {fatiasDaEquipe.length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Por tipo
          </h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">
            {total.realizadas} {total.realizadas === 1 ? 'visita realizada' : 'visitas realizadas'}{' '}
            no período.
          </p>
          <BarrasPorTipo fatias={fatiasDaEquipe} />
        </section>
      )}
```

A seção some inteira quando não há realizadas: cinco barras zeradas não informam nada e ainda sugerem que o sistema quebrou.

- [ ] **Step 3: Conferir no navegador**

Num terminal:

```bash
npx tsx scripts/banco-local.mts
```

Noutro:

```bash
npm run dev
```

Entrar como gestor, abrir `/painel`, escolher "30 dias". Confirmar: a seção "Por tipo" aparece entre a taxa de conclusão e o "Por vendedor"; as barras são **violeta**, não azuis nem verdes; a barra mais longa é a do maior percentual; e o número à direita bate com o comprimento.

Se não houver visita realizada no banco local, marcar uma como realizada pela agenda antes de conferir — a seção só existe quando há dado.

- [ ] **Step 4: Rodar a suíte e o build**

Run: `npm test && npm run build`
Expected: todos os testes passam e o build compila

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/painel/page.tsx"
git commit -m "feat(painel): seção de distribuição por tipo da equipe"
```

---

## Task 5: O card do vendedor, com expansão por toque

**Files:**
- Create: `src/app/(app)/painel/CardVendedor.tsx`
- Modify: `src/app/(app)/painel/page.tsx`

**Interfaces:**
- Consumes: `type LinhaPainel` (o que `resumoPorVendedor` devolve), `type FatiaTipo` (Task 1), `<BarrasPorTipo>` (Task 3)
- Produces: `<CardVendedor linha={LinhaPainel} fatias={FatiaTipo[]} />`

- [ ] **Step 1: Criar o componente**

`src/app/(app)/painel/CardVendedor.tsx`:

```tsx
'use client'
import { useId, useState } from 'react'
import type { FatiaTipo } from '@/lib/visita/painel-tipos'
// `import type` não é estilo, é necessidade: este é Client Component, e um
// import comum de `repositorio` arrastaria o Drizzle e o driver do Postgres
// para o pacote que vai ao navegador. Com `import type` o TypeScript apaga a
// linha na compilação e nada de servidor atravessa.
import type { LinhaPainel } from '@/lib/visita/repositorio'
import { BarrasPorTipo } from './BarrasPorTipo'

export function CardVendedor({ linha, fatias }: { linha: LinhaPainel; fatias: FatiaTipo[] }) {
  const [aberto, setAberto] = useState(false)
  const idDetalhe = useId()

  const fechadas = linha.realizadas + linha.canceladas
  const pct = fechadas === 0 ? 0 : Math.round((linha.realizadas / fechadas) * 100)
  const totalStatus = linha.realizadas + linha.aFazer + linha.canceladas + linha.reagendadas

  const resumo = fatias.map((f) => `${f.rotulo} ${f.total}`).join(' · ')

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="truncate font-display text-lg font-semibold">{linha.vendedor}</h3>
        <span className="shrink-0 font-display text-lg font-semibold text-feita">
          {linha.realizadas}
        </span>
      </div>

      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
        {/* A barra é a distribuição real do trabalho dele, não um enfeite:
            cada faixa é uma fatia dos status no período. */}
        <Faixa n={linha.realizadas} de={totalStatus} cor="bg-feita" />
        <Faixa n={linha.aFazer} de={totalStatus} cor="bg-fazer" />
        <Faixa n={linha.reagendadas} de={totalStatus} cor="bg-adiada" />
        <Faixa n={linha.canceladas} de={totalStatus} cor="bg-morta" />
      </div>

      <p className="mt-2 text-sm text-slate-500">
        {linha.aFazer} a fazer · {linha.reagendadas} reagendadas · {linha.canceladas} canceladas
        {fechadas > 0 && ` · ${pct}% de conclusão`}
      </p>

      {/* Sem realizadas não há tipos para mostrar, e um botão que abre o vazio
          é pior do que botão nenhum. */}
      {fatias.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            aria-controls={idDetalhe}
            className="mt-1 flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm text-slate-600"
          >
            <span className="truncate">{resumo}</span>
            <span aria-hidden className={`shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </button>

          {aberto && (
            <div id={idDetalhe} className="mt-2 border-t border-slate-100 pt-3">
              <BarrasPorTipo fatias={fatias} compacto />
            </div>
          )}
        </>
      )}
    </article>
  )
}

function Faixa({ n, de, cor }: { n: number; de: number; cor: string }) {
  if (n === 0 || de === 0) return null
  return <div className={cor} style={{ width: `${(n / de) * 100}%` }} />
}
```

- [ ] **Step 2: Usar o componente na página**

Em `src/app/(app)/painel/page.tsx`, substituir todo o `{linhas.map((l) => { … })}` da seção "Por vendedor" por:

```tsx
        {linhas.map((l) => (
          <CardVendedor
            key={l.usuarioId}
            linha={l}
            fatias={fatiasPorTipo(contagens.filter((c) => c.usuarioId === l.usuarioId))}
          />
        ))}
```

Acrescentar o import:

```tsx
import { CardVendedor } from './CardVendedor'
```

E **apagar** do fim do arquivo a função `Faixa`, que agora vive dentro do `CardVendedor.tsx` e ficaria sem uso aqui.

- [ ] **Step 3: Conferir que nada ficou órfão**

Run: `npx tsc --noEmit`
Expected: sem saída. Se acusar `Faixa` declarada e não usada, ela não foi removida do `page.tsx`.

- [ ] **Step 4: Conferir no navegador**

Com o banco local e o `npm run dev` rodando, abrir `/painel`:

- o card de cada vendedor mostra a linha `Prospecção 9 · Manutenção 6` com uma seta;
- tocar abre as barras compactas, tocar de novo fecha;
- navegando por `Tab`, o botão recebe foco visível e `Enter` abre;
- um vendedor sem visitas realizadas não mostra botão nenhum;
- estreitando a janela para 375px, a linha de resumo trunca em vez de quebrar o card.

- [ ] **Step 5: Rodar a suíte e o build**

Run: `npm test && npm run build`
Expected: todos passam, build compila

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/painel/CardVendedor.tsx" "src/app/(app)/painel/page.tsx"
git commit -m "feat(painel): tipos por vendedor, expandidos por toque"
```

---

## Encerramento

Ao fim da Task 5 o gestor abre `/painel` e vê, entre a taxa de conclusão e o detalhe por pessoa, para onde foi o esforço do período — e consegue abrir o mesmo recorte de qualquer vendedor antes de uma conversa individual.

**Verificação final:**

```bash
npm test
npm run build
```

E no navegador, em 375px de largura: a seção da equipe cabe sem rolagem horizontal, e o painel continua escaneável com todos os cards fechados.
