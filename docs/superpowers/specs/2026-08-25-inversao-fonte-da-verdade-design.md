# Inversão da fonte da verdade — Design

**Data:** 2026-08-25
**Fatia:** A (de A → B → C)
**Substitui:** a decisão 3.1 do design de 2026-08-24

Este documento inverte a decisão fundadora do projeto. O design original
([2026-08-24](2026-08-24-pwa-gestao-visitas-design.md), seção 3.1) diz:

> O Zaple é a fonte da verdade; nosso banco guarda só o que ele não sabe guardar.

Esta spec diz o contrário: **o Postgres é a fonte da verdade das visitas, e o
Zaple recebe uma cópia.** Tudo o mais neste documento decorre dessa troca.

---

## 1. Por que inverter

A decisão veio do produto, não da engenharia. Três constatações do cliente, em
2026-08-25:

1. **O painel do Zaple foi configurado como template de teste.** As etapas
   (`Prospecção → Visita → RECORRENTE → Concluído`) não descrevem a operação
   real; foram herdadas de uma configuração inicial que ninguém validou.
2. **O gestor não vai olhar o CRM.** Ele vai olhar um dashboard dentro desta
   ferramenta. O painel de visitas do Zaple deixa de ser a tela de gestão.
3. **O CRM serve para duas coisas:** puxar o cliente já cadastrado e receber a
   anotação da visita.

A isso soma-se um motivo técnico que apareceu sozinho. Em 2026-08-25, criar uma
visita falhou porque o Zaple recusou o responsável, e o vendedor ficou sem
recurso: a visita não existia em lugar nenhum. Com o dado sendo nosso, a recusa
do Zaple deixa de ser bloqueio — vira pendência de sincronismo.

### O que isso destrava

Agregação. Um dashboard que soma visitas por vendedor, por período e por status
é uma consulta SQL. Pela API do Zaple seria paginação sobre paginação, lenta e
frágil. **A Fatia C só é viável depois desta inversão** — o pedido de dashboard
já continha, implicitamente, o pedido de inverter.

---

## 2. Decisões

| # | Decisão | Alternativa descartada |
|---|---|---|
| 2.1 | A visita nasce e vive no Postgres | continuar lendo cards do Zaple |
| 2.2 | Quatro status: `a_fazer`, `realizada`, `cancelada`, `reagendada` | três status (modelo Contele) |
| 2.3 | Sem check-in, sem GPS | check-in geolocalizado, padrão do mercado |
| 2.4 | Um card no Zaple por visita | um card por cliente, com as visitas como notas |
| 2.5 | O banco nasce vazio | importar os cards `PDV-1..7` como histórico |
| 2.6 | Reagendar cria uma visita nova, ligada à anterior | mudar a data na mesma linha |
| 2.7 | As etapas do painel passam a espelhar os quatro status | manter o funil atual e mapear por baixo |
| 2.8 | A tela do vendedor vira agenda por data | manter kanban |

### 2.3 — Por que sem check-in, contra o padrão do mercado

A pesquisa de mercado (2026-08-25, 20 ferramentas) mostrou que nas líderes o
status **não** é um botão: é consequência de um check-in geolocalizado. Não
seguimos esse padrão por uma razão concreta — **não temos o endereço do
cliente.**

O contato no Zaple tem `id`, `nome`, `telefone`, `email`; os campos
customizados do painel são `CPF OU CNPJ`, `TIPO DE CLIENTE`, `EMPRESA`,
`TEMPO DE COMPRA`. Sem endereço, uma coordenada de GPS registra onde o vendedor
estava, mas não prova que ele estava no cliente. O dado nasceria ininterpretável.

Cadastrar o endereço da carteira é um projeto operacional próprio. Quando
existir, destrava check-in, mapa e rota de uma vez.

### 2.4 — Por que um card por visita, com o risco registrado

Escolha do cliente, contra a recomendação deste documento. O risco é aritmético:
um vendedor com seis visitas por dia gera cerca de **130 cards por mês**; a
equipe inteira, alguns milhares por ano. O painel do Zaple fica inutilizável
como tela de leitura.

Aceitável porque a decisão 1.2 já diz que ninguém vai usar aquele painel para
gerir. Fica registrado para o dia em que alguém perguntar por que o painel tem
4.000 cards.

### 2.8 — Por que a agenda, com evidência

Das 20 ferramentas pesquisadas, **nenhuma usa kanban como tela principal no
mobile.** O padrão do segmento equivalente ao nosso (B2B agendado) é agenda ou
lista do dia, verificado em Auvo, Contele Teams, Skynamo e Repsly. Ferramentas
mapa-first (Badger Maps, SalesRabbit, Spotio) atendem prospecção por território,
que é outro problema.

---

## 3. Modelo de dados

### 3.1 Tabela `visita`

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | nosso, independente do Zaple |
| `contato_id` | uuid | o cliente no Zaple |
| `contato_nome` | text | **congelado** na criação |
| `usuario_id` | uuid fk → `usuario` | o vendedor |
| `zaple_user_id` | uuid | o mesmo vínculo de sempre: `responsibleUserId` |
| `data` | date | o eixo da agenda |
| `status` | enum | `a_fazer` · `realizada` · `cancelada` · `reagendada` |
| `tipo` | enum | `prospeccao` · `recorrente` |
| `titulo` | text | |
| `relatorio` | text nulo | preenchido ao concluir |
| `origem_id` | uuid nulo fk → `visita` | de qual visita esta foi reagendada |
| `card_id` | uuid nulo | o card espelho no Zaple |
| `sincronizado_em` | timestamptz nulo | nulo = a cópia ainda não chegou lá |
| `criada_em`, `atualizada_em` | timestamptz | |

`contato_nome` é congelado pelo mesmo motivo que `contato_nome_snapshot` na
spec anterior: sem ele, montar o dashboard exigiria uma chamada à API do Zaple
por linha, e renomear um cliente reescreveria o passado.

Índices: `(usuario_id, data)` serve a agenda do vendedor, que é a consulta mais
frequente do app. `(data, status)` serve o dashboard.

### 3.2 O que **não** entra

- **Coordenadas.** Decisão 2.3. Quando houver endereço, entram como colunas
  novas — não como migração de dados.
- **Motivo de cancelamento.** Pendência 8.2: ninguém definiu ainda se o
  vendedor escolhe de uma lista ou escreve livre. Inventar o campo agora seria
  chutar a pergunta.
- **Checklist estruturado.** Continua sendo Fatia 2 do plano original.

---

## 4. Fluxos

### 4.1 Criar visita

1. Busca o cliente no Zaple (`POST /core/v1/contact/filter` por nome, ou
   `GET /core/v1/contact/phoneNumber/{n}`). Se não existe, cria.
2. **Insere a linha em `visita`.** A operação já é um sucesso aqui.
3. Responde ao vendedor.
4. Em seguida, cria o card espelho no Zaple e grava `card_id` e
   `sincronizado_em`. Falhou? `sincronizado_em` fica nulo; o vendedor não vê
   erro, porque para ele não houve erro.

O passo 2 vir antes do passo 4 é a inversão inteira, em uma frase.

### 4.2 Marcar realizada

1. O vendedor toca `✓` na lista. A interface move o item de seção na hora,
   sem esperar a rede.
2. `status = 'realizada'`, `relatorio` se houver.
3. Em seguida: grava a nota no card (`POST /crm/v1/panel/card/{id}/note`) e
   move o card para a etapa `Realizada`.

### 4.3 Cancelar

Igual a 4.2, com `status = 'cancelada'` e etapa `Cancelada`.

### 4.4 Reagendar

Duas linhas, não uma:

1. A visita atual recebe `status = 'reagendada'` e para de aparecer na agenda.
2. Nasce uma visita nova, `a_fazer`, com a data escolhida e
   `origem_id` = a anterior.

Assim o dashboard responde *"quantas visitas foram empurradas este mês"* e a
data original não se perde. Uma linha só com contador geraria o número, mas
apagaria quando cada adiamento aconteceu.

### 4.5 Sincronismo pendente

`sincronizado_em IS NULL` é a fila. Para a primeira versão basta uma seção em
`/admin` listando as visitas não sincronizadas com um botão "tentar de novo"
por linha — sem agendador, sem backoff, sem processo de fundo. Fila automática
é problema da Fatia C, quando houver volume que justifique.

O que **não** acontece: o vendedor nunca é bloqueado por falha do Zaple.

---

## 5. Integração com o Zaple

O módulo `src/lib/zaple/` sobrevive inteiro e muda de papel — de fonte de
leitura para destino de escrita.

| Uso | Endpoint | Direção |
|---|---|---|
| Buscar cliente | `POST /core/v1/contact/filter` | entrada |
| Criar cliente | `POST /core/v1/contact` | saída |
| Criar card espelho | `POST /crm/v2/panel/card` | saída |
| Gravar relatório | `POST /crm/v1/panel/card/{id}/note` | saída |
| Mover etapa do espelho | `PUT /crm/v3/panel/card/{id}` | saída |
| Listar agentes | `GET /core/v1/agent` | entrada, admin |

**Não há nota de contato.** Verificado em 2026-08-25 contra a API: quatro
variações (`/core/v1/contact/{id}/note`, `/notes`, `/core/v1/note?ContactId=`,
`/crm/v1/contact/{id}/note`) devolvem 404. A anotação só existe presa a um card
— é por isso que a decisão 2.4 tem que criar card, e não pôde ser "só contatos".

### 5.1 Mudança no painel (ação do cliente, fora do código)

As etapas passam a ser **A fazer · Realizada · Cancelada · Reagendada**.
Prospecção e Recorrente viram etiqueta no card, não etapa.

Enquanto isso não for feito no Zaple, o sincronismo aponta para as etapas
antigas por um mapa de configuração. O app não trava por causa disso.

---

## 6. O que muda no código

| | |
|---|---|
| **Sai** | `Quadro.tsx`, `QuadroDesktop.tsx`, `CartaoVisita.tsx`, a rota `mover`, `listarVisitas()` como fonte de tela, a página `/kanban`, **e `src/lib/visita/regras.ts` inteiro** |
| **Entra** | migração da tabela `visita`, `src/lib/visita/repositorio.ts`, `src/lib/visita/sincronizador.ts`, rotas sobre SQL, a página `/agenda` |
| **Fica** | `src/lib/zaple/` inteiro, `src/lib/auth/` inteiro, `src/lib/api/`, login, admin |

`regras.ts` sai por inteiro porque suas duas funções — `proximaEtapa` e
`podeMover` — existem só para o vendedor mover cards entre etapas do painel,
que é exatamente a ação que deixa de existir. O sincronizador precisa de um
mapa `status → etapa`, não de navegação sequencial pelo funil.

Parte da Fatia 1 — verificada e funcionando — é descartada. É o preço da
decisão 2.1, e está aceito.

---

## 7. Testes

Os 101 testes de hoje se dividem assim:

- **Continuam válidos:** `zaple/*` (6 arquivos), `auth/*` (2), `db/schema`,
  `manifest`, `api/erro-da-resposta`, `api/login`, `api/usuarios`.
- **Reescritos:** `api/criar-visita`, `api/visitas`, `api/visita-detalhe`.
- **Removidos:** `api/mover` e `visita/regras` (8 casos) — as ações que eles
  cobrem deixam de existir.
- **Novos:** repositório (CRUD e as consultas de agenda), reagendamento
  gerando duas linhas ligadas, sincronizador marcando e não marcando
  `sincronizado_em`, e o caso que originou tudo: **falha do Zaple não impede a
  visita de existir.**

Continua valendo o Postgres embarcado (`scripts/banco-local.mts`) para rodar
tudo sem nuvem.

---

## 8. Riscos e pendências

**8.1 — O significado de `RECORRENTE` nunca foi confirmado.** A spec anterior
já registrava isso como inferência. Esta spec o transforma em `tipo`, o que
reduz o risco (é etiqueta, não fluxo), mas não o elimina: se `RECORRENTE`
significa outra coisa na operação, o campo `tipo` muda de significado.

**8.2 — Cancelamento sem motivo.** O dashboard vai mostrar "8 canceladas" sem
dizer por quê. Definir a lista de motivos com a operação antes da Fatia C.

**8.3 — O painel do Zaple vai inchar.** Decisão 2.4, consciente.

**8.4 — `tipo` é premissa, não requisito confirmado.** O cliente aprovou quatro
status, mas o campo `tipo` separado foi proposta deste documento e não teve
confirmação explícita. Se não servir, é uma coluna a remover — barato agora,
caro depois do dashboard pronto.

**8.5 — Sem endereço, sem mapa.** Duas das três referências visuais do cliente
têm mapa. Ele é impossível até a carteira ter endereço cadastrado.

---

## 9. Fora de escopo

Fatia B (paleta, componentes, o desenho da agenda), Fatia C (dashboard),
checklist estruturado, offline com IndexedDB, notificações, upload de foto
(bloqueado pelo token), login por WhatsApp (idem).

---

## 10. Ordem de entrega

1. Migração da tabela `visita` + repositório + testes.
2. Rotas de API sobre o repositório.
3. Sincronizador do Zaple, com falha não-bloqueante.
4. Tela de agenda, funcional e sem tratamento visual — o visual é a Fatia B.
5. Remoção do kanban.

O passo 4 entrega uma tela feia que funciona. É deliberado: a Fatia B trata
o visual inteiro de uma vez, e adiantar estilo aqui seria trabalho jogado fora.
