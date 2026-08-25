# PWA de Gestão de Visitas — Design

- **Data:** 2026-08-24
- **Status:** aprovado, pronto para o plano de implementação
- **Cliente:** Alta Performance RJ (`companyId` c45aea9e-016b-492a-a803-16e4bc19cf59)
- **CRM:** Zaple / WTS Chat — `https://api.wts.chat`

---

## 1. Problema

Os vendedores da Alta Performance visitam clientes em campo. Hoje o registro dessas visitas depende de abrir o Zaple no navegador do celular — uma interface de desktop espremida — e o que foi conversado na visita fica em texto solto, impossível de consolidar.

O PWA substitui essa tela para o caso de uso de visitas: vira **a** ferramenta do vendedor em campo (kanban próprio, mais o registro estruturado da visita) e dá ao gestor um dashboard com exportação.

O Zaple continua sendo o sistema de registro. Quem preferir abrir o Zaple direto enxerga exatamente a mesma realidade.

### Sucesso

- O vendedor registra uma visita completa em menos de dois minutos, no celular, sem perder nada se o sinal cair.
- O gestor responde "quantas visitas o Danilo fez em setembro?" e "quantos clientes disseram X?" sem abrir planilha na mão.
- Ninguém precisa reconciliar PWA e Zaple: eles nunca discordam.

---

## 2. O que a API do Zaple realmente oferece

Verificado ao vivo em 2026-08-24 contra o token de painel fornecido.

### Painel alvo

`PAINEL DE VISITAS` — `fd605396-cc03-4e8a-bf7d-aa2b91594cf1`
Tipo `MANAGEMENT`, escopo `DEPARTMENT` (departamento d9a62508-2a15-4eb2-9e20-b10c4b7a6234).
Zero cards hoje — o painel nasce com o PWA.

Etapas, em ordem:

| # | Etapa | stepId | Inicial | Final |
|---|---|---|---|---|
| 1 | Prospecção | `e5b1546c-f374-4d85-a8a2-25e424211c48` | sim | não |
| 2 | Visita | `8d008670-0b2a-4349-9375-716e62b0ef58` | não | não |
| 3 | RECORRENTE | `e76733df-0a6d-441c-bb7b-7c0969f3bd89` | não | não |
| 4 | Concluído | `45a0d42f-612c-43dc-a139-42a13fa22674` | não | sim |

O painel **não tem custom fields próprios** (`GET /crm/v1/panel/{id}/custom-fields` retorna `[]`), e por ser `MANAGEMENT` não aceita motivos de perda — a API responde explicitamente que isso é exclusivo de painéis de Vendas. Portanto o dado da visita vai para `metadata` do card e para a nota, não para custom fields.

### Endpoints usados

| Verbo | Rota | Uso |
|---|---|---|
| GET | `/crm/v2/panel/card` | listar o kanban (filtros `StepId`, `ResponsibleUserId`, `Statuses`, `CreatedAt.After/Before`, `TextFilter`; `IncludeDetails` para trazer contato, responsável, etapa) |
| GET | `/crm/v2/panel/card/{id}` | abrir uma visita |
| POST | `/crm/v2/panel/card` | criar visita |
| PUT | `/crm/v3/panel/card/{id}` | mover etapa, alterar prazo/responsável, gravar `metadata` |
| GET/POST | `/crm/v1/panel/card/{cardId}/note` | ler e gravar o relatório |
| GET/POST | `/core/v1/contact` | buscar e criar o cliente visitado |
| GET | `/core/v1/agent` | lista de vendedores para vincular no admin |
| GET | `/core/v1/tag` | etiquetas, se usadas |

Paginação: `PageNumber` (base 1) e `PageSize` (máximo 100). A resposta traz `totalItems`, `totalPages`, `hasMorePages`.

`PUT /crm/v3/panel/card/{id}` exige o array `fields` listando o que está sendo alterado — atualização parcial explícita, não merge implícito. O cliente HTTP deve montar esse array a partir das chaves passadas, para não existir chance de um campo ser enviado sem estar declarado.

### Limites do token atual — restrição de projeto

O token `pn_...` é **de painel**, não da conta. Testado endpoint a endpoint:

| Escopo | Resultado |
|---|---|
| Painéis, cards, notas | liberado |
| Contatos, departamentos, tags, agentes, custom fields | liberado |
| Webhooks (`GET /core/v1/webhook/event` e `/subscription`) | liberado |
| Envio de mensagem, OTP, templates, canais | `ERROR_UNAUTHORIZED` |
| Atendimentos (`session`), mensagens, arquivos, chatbot | `ERROR_UNAUTHORIZED` |

**Consequência direta:** nenhum envio de WhatsApp a partir do PWA — nem OTP de login, nem notificação de cliente — enquanto não existir um token de conta com permissão de envio. Isso está refletido na decisão de login (seção 3.4).

Consequência secundária: sem acesso a arquivos, **não há upload de foto**. Já estava fora de escopo por decisão de produto; agora também está fora por limite técnico.

### Webhooks disponíveis (não usados nesta versão)

`PANEL_CARD_NEW`, `PANEL_CARD_UPDATE`, `PANEL_CARD_STEP_CHANGE`, `PANEL_CARD_NOTE_NEW`, além dos de contato e sessão. Ficam registrados como o caminho natural caso um dia se queira kanban em tempo real ou espelho local.

### Campos de contato existentes

`CPF OU CNPJ` (texto), `TIPO DE CLIENTE` (seleção: EMPRESA / PESSOA FÍSICA), `EMPRESA` (texto), `TEMPO DE COMPRA` (texto).

---

## 3. Decisões de arquitetura

### 3.1 O Zaple é a fonte da verdade; nosso banco guarda só o que ele não sabe guardar

Alternativa descartada: espelhar os cards num Postgres alimentado por webhook. Daria kanban instantâneo e dashboards ricos, mas cria duas verdades — e todo bug de sincronia vira "o app mostra uma coisa e o Zaple outra". Para 15 vendedores e um painel que hoje tem zero cards, o custo não se paga.

Alternativa descartada: nada de banco próprio, tudo em `metadata`/nota. Barato hoje, mas inviabiliza o dashboard do gestor e a exportação — a resposta do checklist ficaria presa dentro de texto corrido.

**Adotado:** o card vive no Zaple; cada visita enviada grava *também* uma linha append-only no nosso banco com as respostas separadas por pergunta. Dado nosso, que nunca conflita com o Zaple, e que é a base do dashboard e do export.

### 3.2 Um projeto: Next.js (App Router) na Vercel

PWA e backend fino no mesmo deploy. O token do Zaple mora em variável de ambiente do servidor e nunca é enviado ao navegador — condição inegociável, já que esse token dá acesso a todos os contatos e painéis da empresa.

```
Celular (PWA)  ──►  Next.js Route Handlers  ──►  api.wts.chat
   IndexedDB              │                       (ZAPLE_TOKEN, server-side)
   rascunhos + fila       └──►  Postgres (Neon)
                                usuarios · perguntas · respostas · fila
```

### 3.3 Três fronteiras internas

- **`lib/zaple/`** — o único módulo que conhece a API do Zaple. Expõe verbos do nosso domínio (`listarVisitas`, `moverEtapa`, `registrarRelatorio`, `buscarContato`), não endpoints crus. Concentra retry, paginação e montagem do array `fields` do PUT v3. Se o Zaple lançar uma v4, muda um arquivo.
- **`lib/auth/`** — interface de duas funções (`iniciarLogin`, `confirmarLogin`) com implementação intercambiável. Hoje: senha. Quando existir token com permissão de envio: OTP por WhatsApp, sem alterar nenhuma tela.
- **`lib/visita/`** — as regras de negócio: o que torna uma visita válida, quando ela pode avançar de etapa, o que a conclusão gera. Sem HTTP e sem banco dentro, portanto testável diretamente.

### 3.4 Login: senha agora, WhatsApp depois

O método preferido é código por WhatsApp, mas ele depende de (a) um token de conta com permissão de envio, (b) um canal WhatsApp ativo e (c) um template do tipo Autenticação aprovado pela Meta — nada disso verificável com o token atual.

A versão 1 entrega **identificador (celular ou e-mail) + senha**, cadastrada pelo gestor no admin. Como o login está atrás da interface de `lib/auth/`, a troca para OTP depois é uma implementação nova, não uma reescrita.

Sessão em cookie `httpOnly`, `Secure`, `SameSite=Lax`, assinado, validade de 30 dias. Sem tabela de sessões: cada requisição revalida `usuario.ativo`, o que basta para desligar alguém imediatamente.

---

## 4. Modelo de dados

### 4.1 Onde mora cada coisa

| Dado | Onde | Por quê |
|---|---|---|
| Card da visita — título, etapa, responsável, prazo, contato | Zaple | fonte da verdade; visível a quem abrir o Zaple |
| Relatório escrito | nota do card | o gestor lê no Zaple sem depender do PWA |
| Checklist, versão legível | nota + `metadata` do card | idem |
| Checklist, versão estruturada | Postgres | é o que vira dashboard e export |
| Identidade do vendedor | Postgres, ligada ao `responsibleUserId` | a API do Zaple não tem login |
| Perguntas do checklist | Postgres | o Zaple não tem esse conceito |
| Rascunho não enviado | IndexedDB no celular | sobrevive a queda de sinal e a fechar o app |

### 4.2 Tabelas

**`usuario`** — `id`, `nome`, `telefone`, `email`, `senha_hash`, `zaple_agent_id`, `papel` (`vendedor` | `gestor`), `ativo`, `criado_em`.

`zaple_agent_id` é o vínculo com o `responsibleUserId` dos cards. Sem ele o vendedor não vê visita nenhuma, então é obrigatório e validado contra `GET /core/v1/agent` no momento do cadastro.

**`checklist_pergunta`** — `id`, `ordem`, `texto`, `tipo` (`texto` | `sim_nao` | `escolha_unica` | `escolha_multipla` | `numero`), `opcoes` (jsonb, quando aplicável), `obrigatoria`, `ativa`, `criado_em`.

Perguntas nunca são apagadas, só desativadas — apagar quebraria o histórico.

**`visita_resposta`** — append-only, uma linha por visita registrada: `id`, `chave_idempotencia` (única), `card_id`, `card_key`, `panel_id`, `step_id_origem`, `step_id_destino`, `usuario_id`, `zaple_agent_id`, `contato_id`, `contato_nome_snapshot`, `respostas` (jsonb), `relatorio` (texto), `proximo_passo` (`concluir` | `retorno`), `proximo_passo_em` (data, quando `retorno`), `enviado_em`, `recebido_em`.

O jsonb `respostas` guarda, por item: `pergunta_id`, **`pergunta_texto` no momento da resposta**, `tipo` e `valor`. Guardar o texto junto é o que impede o histórico de passar a mentir no dia em que uma pergunta for editada.

`contato_nome_snapshot` existe pela mesma razão, e é o que permite montar o histórico por cliente sem uma consulta ao Zaple por linha.

**`fila_envio`** — o registro de cada envio, usado tanto para recuperação quanto para auditoria: `id`, `chave_idempotencia`, `usuario_id`, `status` (`recebido` | `aplicado` | `rejeitado`), `erro`, `criado_em`, `atualizado_em`. É o que permite reprocessar um envio que morreu no meio (seção 8) e o que responde a "o vendedor jura que enviou".

---

## 5. Fluxos

### 5.1 Registrar uma visita

1. O vendedor abre a visita e toca em *Registrar visita*.
2. Responde o checklist e escreve o relatório. Cada pausa na digitação salva o rascunho no IndexedDB, com uma `chave_idempotencia` gerada na criação do rascunho.
3. Escolhe o próximo passo: **concluir** ou **agendar retorno** (com data).
4. Ao enviar, o backend executa como uma operação única, **nesta ordem** (a mesma da seção 8):
   - revalida que o card ainda está na etapa esperada;
   - insere a linha em `visita_resposta` e registra `fila_envio` como `recebido`;
   - grava a nota no card com o relatório e o checklist em forma legível;
   - grava `metadata` no card;
   - move o card de etapa;
   - marca `fila_envio` como `aplicado`.
5. Confirmado, o rascunho é removido do IndexedDB.

Se a rede cair em qualquer ponto do passo 4, o rascunho permanece e entra na fila.

### 5.2 Avanço de etapa

`Prospecção → Visita → RECORRENTE → Concluído`.

Ao registrar a visita, o próximo passo determina o destino:

- **concluir** → o card vai para `Concluído`.
- **agendar retorno** → o card vai para `RECORRENTE` e recebe `dueDate` com a data escolhida. A próxima visita é o mesmo card, reagendado — não um card novo. Isso mantém a linha do tempo do cliente num só lugar e evita multiplicar cards.

O vendedor também pode mover um card manualmente entre etapas, sem registrar visita — é o que serve para arrastar de `Prospecção` para `Visita` ao planejar o dia.

> **A confirmar antes da implementação:** este entendimento de `RECORRENTE` foi inferido do nome da etapa, não informado. Se a operação da Alta Performance usa `RECORRENTE` com outro significado (por exemplo, uma carteira fixa de clientes de visita periódica, separada das prospecções), a regra desta seção muda.

### 5.3 Criar uma visita

Busca o contato no Zaple por telefone ou nome (`GET /core/v1/contact`). Se não existir, cria (`POST /core/v1/contact`). Depois cria o card com `stepId` de `Prospecção`, título, responsável e prazo.

**Validação nossa:** a visita não nasce sem responsável e sem contato. A API do Zaple aceita card órfão — o card que existe hoje no painel de vendas tem `responsibleUserId: null` e `contacts: []` — mas card órfão é invisível para o vendedor e incontável para o gestor.

---

## 6. Telas

### Vendedor

- **Kanban** — as quatro etapas. No desktop, arrastar o card. No celular, uma etapa por vez com swipe lateral e botão de avançar no card: arrastar entre colunas em tela pequena é frustrante e erra o alvo. Por padrão mostra apenas as visitas do próprio vendedor (filtro `ResponsibleUserId`).
- **Detalhe da visita** — cliente, prazo, responsável, e o histórico das visitas anteriores. Ação primária: *Registrar visita*.
- **Registrar visita** — checklist, relatório, próximo passo. Autosave.
- **Nova visita** — busca ou cria o contato, define responsável e prazo.

### Gestor

Tudo do vendedor, mais o botão "ver todos" no kanban, mais:

- **Dashboard** — seção 7.
- **Admin** — cadastro de vendedores (vinculando ao agente do Zaple) e edição das perguntas do checklist.

### PWA

Manifest, ícones, service worker, instalável na tela inicial. O service worker faz cache do casco do app (shell) e dos assets; dados de card não são cacheados agressivamente, para não exibir kanban desatualizado como se fosse atual.

---

## 7. Dashboard e exportação

Três perguntas, escolhidas pelo gestor:

1. **Produtividade por vendedor** — visitas registradas no período por vendedor, distribuição por etapa, concluídas x em aberto. A contagem por etapa vem do Zaple na hora (`GET /crm/v2/panel/card` com filtro de responsável e período), com cache curto de 60 segundos. As visitas registradas vêm do nosso banco.
2. **Respostas agregadas do checklist** — por pergunta, a distribuição das respostas no período ("concorrente presente: 34 de 80"). Vem inteiramente do nosso banco. Perguntas de texto livre não são agregadas; aparecem como lista.
3. **Histórico por cliente** — busca o cliente e mostra a linha do tempo de visitas, relatórios e respostas. Vem do nosso banco (`contato_id`), sem uma chamada ao Zaple por linha.

Filtros: período e vendedor.

### Exportação

**CSV em UTF-8 com BOM** — o BOM é o que faz o Excel em português abrir o arquivo com os acentos certos sem passar pelo assistente de importação. Uma linha por visita. Colunas fixas — data, vendedor, cliente, etapa de origem e destino, próximo passo, data do retorno, relatório — seguidas de **uma coluna por pergunta ativa do checklist**. É o formato que entra direto em tabela dinâmica.

Perguntas desativadas aparecem no export apenas se houver resposta no período filtrado, para que exportações antigas continuem completas.

Geração no servidor, em streaming, para não estourar memória quando o volume crescer.

---

## 8. Erros e resiliência

O caminho feliz não é o risco; app de campo quebra nas bordas.

- **Sinal cai durante o envio** — o rascunho já está no IndexedDB e entra na fila. Sobe sozinho quando a rede volta, com indicação visível de "1 visita pendente de envio". O vendedor nunca perde o que digitou.
- **Envio duplicado** — cada rascunho carrega uma `chave_idempotencia` criada junto com ele. O backend recusa a segunda tentativa da mesma chave e devolve o resultado da primeira. Sem isso, fila somada a botão ansioso produz relatório em dobro no card.
- **O card mudou no Zaple durante o preenchimento** — antes de aplicar, o backend revalida a etapa atual do card. Se alguém já moveu, o vendedor é avisado e decide, em vez de o app sobrescrever em silêncio.
- **Zaple indisponível ou limitando requisições** — retry com espera crescente dentro de `lib/zaple/`, teto de tentativas, e mensagem honesta na tela em vez de spinner infinito.
- **Aplicação parcial** — o envio grava nota, metadata, banco e movimento de etapa. Não há transação distribuída possível entre Zaple e nosso Postgres; a ordem é escolhida para que qualquer falha no meio deixe o sistema num estado recuperável, e a `fila_envio` registra o que foi aplicado. Concretamente: grava-se primeiro no nosso banco (com status `recebido`), depois no Zaple, e só então marca-se `aplicado`. Uma linha em `recebido` há mais de alguns minutos é reprocessável sem duplicar, graças à chave de idempotência.

---

## 9. Segurança

- O token do Zaple existe apenas no servidor, em variável de ambiente. Nunca é transmitido ao navegador, nem em resposta de API, nem em log.
- Toda rota de API valida a sessão e o papel. Vendedor não acessa dado de outro vendedor; apenas o gestor consulta a base inteira e exporta.
- Senhas com hash forte (argon2id ou bcrypt com custo adequado).
- Rate limit no login, para que uma lista de celulares não vire ataque de força bruta.
- O export é uma rota de gestor, autenticada, sem URL adivinhável ou compartilhável.

---

## 10. Testes

- **`lib/visita/`** — regras puras, testadas diretamente: transições de etapa válidas e inválidas, obrigatoriedade de respostas, o que a conclusão gera.
- **`lib/zaple/`** — testado contra as respostas reais capturadas em 2026-08-24 (painel, etapas, card, contatos, agentes), incluindo os formatos de erro observados (`ERROR_UNAUTHORIZED`, `FORM_ERROR`).
- **Fila e idempotência** — envio com falha de rede no meio, reenvio da mesma chave, garantia de card com uma única nota.
- **Ponta a ponta do caminho crítico** — entrar, abrir visita, preencher, perder a rede, recuperar, e confirmar card movido com nota gravada.

---

## 11. Fora de escopo

Decidido explicitamente, para não voltar por inércia:

- **Check-in por GPS** — descartado pelo cliente.
- **Fotos da visita** — descartado pelo cliente, e tecnicamente impossível com o token atual (sem acesso a arquivos).
- **Notificação por WhatsApp** ao cliente ou ao gestor — bloqueado pelo escopo do token.
- **Roteirização por proximidade** — não pedido.
- **Alertas de visita atrasada / cliente sem retorno** — não escolhido no dashboard. O campo `isOverdue` já vem do Zaple, então é barato acrescentar depois.
- **Espelho local dos cards e kanban em tempo real via webhook** — desnecessário nesta escala; os eventos existem e ficam disponíveis se um dia mudar.
- **Offline completo** (mover card e abrir kanban sem rede) — só rascunho e fila.

---

## 12. Riscos e pendências

| Item | Impacto | Encaminhamento |
|---|---|---|
| Significado real da etapa `RECORRENTE` | muda a regra da seção 5.2 | confirmar antes de implementar o fluxo de próximo passo |
| Token sem permissão de envio | sem OTP e sem notificação | gerar token de conta no Zaple quando se quiser o login por WhatsApp; a interface de `lib/auth/` já prevê |
| Template WhatsApp de Autenticação | pré-requisito do OTP | aprovação Meta leva dias; iniciar cedo se o OTP for prioridade |
| 9 dos 15 agentes sem e-mail no Zaple | cadastro por e-mail não cobre a equipe | o login aceita celular como identificador |
| Painel é `DEPARTMENT` | visibilidade depende do departamento | confirmar que todos os vendedores pertencem ao departamento d9a62508 |

---

## 13. Ordem de entrega

O escopo é grande demais para uma entrega única útil. Três fatias, cada uma valendo por si:

1. **O vendedor consegue trabalhar** — login por senha, kanban das quatro etapas, detalhe da visita, criar visita, mover etapa. Sem checklist e sem offline. Ao fim desta fatia o PWA já substitui o Zaple no celular.
2. **A visita vira dado** — checklist configurável, relatório, próximo passo, gravação em nota + `metadata` + `visita_resposta`, rascunho no IndexedDB e fila de envio com idempotência. É a fatia que dá sentido ao projeto.
3. **O gestor enxerga** — dashboard (produtividade, agregação do checklist, histórico por cliente), export CSV e admin de usuários e perguntas.

O admin de usuários é pré-requisito da fatia 1 (alguém precisa cadastrar os vendedores); entra ali na forma mínima — cadastrar, vincular ao agente do Zaple, desativar — e ganha o resto na fatia 3.
