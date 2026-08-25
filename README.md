# Gestão de Visitas

PWA de gestão de visitas em campo, integrado ao CRM Zaple (WTS Chat) da Alta Performance RJ.

O vendedor abre no celular, vê o kanban das visitas dele, cria visita vinculada a um
cliente do CRM e move o card entre as etapas. O Zaple continua sendo a fonte da
verdade: quem abrir o painel lá enxerga exatamente a mesma coisa.

- **Spec:** [`docs/superpowers/specs/2026-08-24-pwa-gestao-visitas-design.md`](docs/superpowers/specs/2026-08-24-pwa-gestao-visitas-design.md)
- **Plano da Fatia 1:** [`docs/superpowers/plans/2026-08-24-pwa-visitas-fatia-1.md`](docs/superpowers/plans/2026-08-24-pwa-visitas-fatia-1.md)

---

## Estado atual

**Fatia 1 — completa e verificada ponta a ponta.**

| | |
|---|---|
| Testes | 95 passando |
| `tsc --noEmit` | limpo |
| `npm run build` | 14 rotas |
| Cliente do Zaple | verificado contra a API de produção |
| Login, kanban, criar visita, mover etapa | verificados contra o painel de produção |

Verificado em 2026-08-24 com o Postgres embarcado: login recusando senha errada e
aceitando a certa (inclusive com o telefone digitado com máscara), kanban filtrado
por vendedor (3 próprias contra 5 no "ver todos"), busca de cliente por nome e por
telefone, criação de visita, movimentação de etapa, e a recusa 409 quando o card já
foi movido no Zaple. O card de teste foi arquivado depois.

**Falta para produção:** apontar `DATABASE_URL` para um Postgres hospedado
(Supabase) e fazer o deploy.

### Rodar localmente sem nuvem

O projeto traz um Postgres embarcado (PGlite) que fala o protocolo de rede do
Postgres, então **nada no código muda** — o app conecta por uma URL `postgresql://`
comum:

```bash
npx tsx scripts/banco-local.mts    # deixe rodando num terminal
```

No `.env`, aponte as duas variáveis para ele:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

Os dados ficam em `.banco-local/` (fora do git). Apague a pasta para começar do zero.

### Apontar para o Supabase

1. Em *Project Settings → Database → Connection string*, pegue duas:

   | Variável | Modo | Porta |
   |---|---|---|
   | `DATABASE_URL` | Transaction pooler | `6543` |
   | `DIRECT_URL` | Direct connection | `5432` |

   Substitua `[YOUR-PASSWORD]` pela senha do banco (não é a senha da conta Supabase;
   dá para gerar outra em *Database → Reset database password*).

2. **Aplique a migração:**

   ```bash
   npx drizzle-kit migrate
   ```

3. **Crie o primeiro gestor.** Sem ele ninguém entra na tela que cadastra pessoas.
   Rodando sem argumentos, o script lista os agentes do Zaple — **use a coluna
   `userId`, não a `id`** (veja a seção de armadilhas):

   ```bash
   npx tsx --env-file=.env scripts/criar-gestor.mts
   npx tsx --env-file=.env scripts/criar-gestor.mts "Seu Nome" "21999999999" "suasenha" "<userId>"
   ```

4. **Suba:** `npm run dev`

### Depois da Fatia 1

- **Fatia 2** — checklist configurável, relatório, próximo passo, rascunho no
  IndexedDB e fila de envio com idempotência, tabela `visita_resposta`.
- **Fatia 3** — dashboard do gestor (produtividade, respostas agregadas, histórico
  por cliente) e exportação CSV.

Cada fatia ganha seu próprio plano, escrito a partir do spec.

---

## Como rodar

```bash
npm install
npm run dev          # servidor de desenvolvimento
npm test             # testes
npm run build        # build de produção
npx next typegen     # regenera os tipos de rota (necessário antes de tsc numa cópia nova)
```

### Variáveis de ambiente

Veja `.env.example`. Todas são de servidor — **nenhuma credencial pode receber o
prefixo `NEXT_PUBLIC_`**. O token do Zaple dá acesso a todos os contatos e painéis
da empresa.

### Scripts de conferência

Rodam contra a API real do Zaple, só leitura:

```bash
npx tsx --env-file=.env scripts/conferir-etapas.mts   # etapas do painel
npx tsx --env-file=.env scripts/conferir-zaple.mts    # etapas, visitas, contatos, agentes
npx tsx --env-file=.env scripts/gerar-icones.mjs      # regera os ícones do PWA
```

---

## Arquitetura

```
Celular (PWA)  ──►  Next.js Route Handlers  ──►  api.wts.chat
                          │                       (ZAPLE_TOKEN, server-side)
                          └──►  Postgres (Supabase)
                                usuarios · tentativas de login
```

Três fronteiras sustentam o resto:

- **`src/lib/zaple/`** — o único módulo que conhece a API do Zaple. Expõe verbos do
  domínio (`listarVisitas`, `moverEtapa`, `buscarContatoPorTelefone`), não endpoints
  crus, e concentra retry, paginação e a montagem do array `fields` do PUT v3.
- **`src/lib/auth/`** — o login fica atrás de uma interface de duas funções, para que
  a troca de senha por OTP no WhatsApp seja uma implementação nova em vez de uma
  reescrita das telas.
- **`src/lib/visita/`** — regras de negócio puras, sem HTTP e sem banco dentro.

Regra de fronteira: **nada fora de `src/lib/zaple/` monta URL da API do Zaple ou lê
`ZAPLE_TOKEN`.**

---

## O que a API do Zaple faz de inesperado

Descoberto testando contra produção, não está na documentação. Se algo parecer
quebrado, comece por aqui:

- **O card aponta para `agent.userId`, não para `agent.id`.** O `responsibleUserId`
  de um card casa com o campo `userId` de dentro do objeto de agente, que é um valor
  diferente do `id` dele. Vincular um vendedor ao `id` deixa o kanban dele vazio
  para sempre, e o sintoma é silencioso: a API responde 200 com zero itens. É por
  isso que a coluna se chama `zaple_user_id`.
  - Corolário: **um card pode pertencer a alguém que não é atendente.** O dono da
    conta aparece como responsável de card sem constar em `/core/v1/agent`, então o
    seletor do admin não consegue oferecê-lo. Ainda não tratado.
- **`GET /crm/v1/panel/{id}` devolve `steps: null`**, mesmo com o painel tendo
  etapas. As etapas só vêm por `GET /crm/v2/panel?IncludeDetails=Steps`.
- **"Não encontrado" volta como HTTP 500** com `key: FORM_ERROR`, não 404 — e o
  campo `httpStatusCode` às vezes vem como string (`"INTERNALSERVERERROR"`). Erro é
  sinalizado pelo corpo (`error: true`), às vezes junto de um HTTP 200: conferir só
  o status deixa erro passar como dado.
- **`GET /core/v1/contact` ignora todo parâmetro de busca em silêncio.**
  `TextFilter`, `Search`, `Name`, `Query` devolvem a base inteira como se tivessem
  filtrado. A busca real é `POST /core/v1/contact/filter` com `{ "name": "..." }`.
- **`PUT /crm/v3/panel/card/{id}` ignora campo não declarado em `fields`**, sem erro.
- **`GET /core/v1/agent` devolve array cru**, sem envelope de paginação, ao contrário
  de quase todos os outros endpoints.
- **Telefone é armazenado como `+55|21977237528`** (com pipe) e buscado como
  `5521977237528`.

### Limites do token atual

O token é de painel (`pn_`), não da conta. Liberado: painéis, cards, notas, contatos,
departamentos, tags, agentes, webhooks. **Negado:** envio de mensagem, OTP,
templates, canais, atendimentos, mensagens e arquivos.

Consequências: não há login por WhatsApp nem upload de foto enquanto não existir um
token de conta com permissão de envio.
