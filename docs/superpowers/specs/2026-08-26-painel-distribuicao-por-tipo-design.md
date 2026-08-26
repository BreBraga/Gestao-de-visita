# Painel — distribuição por tipo de visita

- **Data:** 2026-08-26
- **Status:** aprovado, pronto para o plano de implementação
- **Depende de:** [inversão da fonte da verdade](2026-08-25-inversao-fonte-da-verdade-design.md) — a visita já mora no nosso Postgres

---

## 1. Problema

O `/painel` hoje responde **quanto** e **quem**: quatro números por status, taxa de
conclusão e um card por vendedor. Não responde **para onde a operação está indo**.

O campo `tipo` da visita — prospecção, manutenção, pedido, entrega, outro — é
preenchido em toda visita criada e não aparece em tela nenhuma. É o dado que separa
uma equipe caçando cliente novo de uma equipe só mantendo a carteira, e hoje ele está
gravado e invisível.

### Sucesso

O gestor abre o painel e vê, sem rolar, para onde foi o esforço do período. E, ao
preparar uma conversa individual, consegue abrir o mesmo recorte de um vendedor.

---

## 2. Escopo

**É:** a distribuição das visitas **realizadas** por tipo, no período já selecionado
pelos botões do painel, em dois níveis — equipe inteira e, sob demanda, por vendedor.

**Não é:** evolução no tempo, comparação entre vendedores num gráfico único, ranking
de clientes, ou qualquer recorte de cliente abandonado. Todos foram considerados e
deixados de fora nesta rodada.

### Por que só as realizadas

Uma prospecção agendada e cancelada não gerou prospecção nenhuma. Contá-la mediria
intenção, não resultado, e inflaria o número de quem agenda muito e cumpre pouco.
O gráfico responde "o que aconteceu em campo", não "o que a equipe planejou".

---

## 3. Onde vive

Uma seção nova em `/painel`, entre a **Taxa de conclusão** e o **Por vendedor**.

A ordem de leitura da página passa a ser: quanto fizemos → com que qualidade → para
onde fomos → quem fez.

### Equipe

Cinco linhas no máximo, uma por tipo com pelo menos uma visita, ordenadas da maior
para a menor. Cada linha traz rótulo, barra proporcional, contagem absoluta e
percentual do total realizado.

Barras horizontais, e não rosca ou barra empilhada, por três razões:
o rótulo fica ao lado do dado e dispensa legenda; comparar dois tipos é comparar
comprimento, que o olho faz bem, ao contrário de ângulo; e a forma sobrevive a uma
tela de 375px, que é onde este app é usado.

### Por vendedor

O card de cada vendedor ganha, por padrão, **uma linha de texto**:
`Prospecção 9 · Manutenção 6 · Pedido 3`.

Essa linha **é o controle**: um `<button>` ocupando a largura do card, que ao ser
acionado expande as mesmas barras horizontais da seção da equipe, em versão compacta.
O card hoje é um `<article>` sem interação, então nada colide com o gesto.

Sendo botão de verdade e não uma `<div>` com `onClick`, ele já vem com foco por
teclado e acionamento por Enter. Carrega `aria-expanded` e `aria-controls` apontando
para o bloco das barras, para que quem usa leitor de tela saiba que há conteúdo
escondido e se ele está aberto. Altura mínima de 44px, como todo alvo de toque deste
app.

A expansão sob demanda existe porque cinco barras dentro de cada card, com quinze
vendedores, produziriam setenta e cinco linhas de gráfico numa tela de celular — o
painel deixaria de ser escaneável para quem só quer o panorama. Quem vai conversar
com uma pessoa específica abre o card dela.

O estado expandido é local ao card e não persiste entre visitas à página.

### Onde o código mora

`/painel` é Server Component e busca os dados direto do banco. Expandir por toque
exige estado no cliente, então o card do vendedor vira Client Component — e só ele,
não a página. A página continua buscando tudo no servidor e passando pronto.

Três arquivos novos, em vez de engordar o `page.tsx` que já tem duas funções auxiliares
dentro:

- `BarrasPorTipo.tsx` — as barras horizontais, usadas nos dois níveis. Recebe as
  fatias já calculadas e só desenha; não sabe de onde vêm.
- `CardVendedor.tsx` — o card, agora com o botão e o estado de expansão. Absorve o
  `<article>` que hoje está inline no `page.tsx`.
E uma alteração pequena em `lib/visita/tipos.ts`, que **já existe** e já é a fonte
única dos tipos: ganha a cor de cada tipo, ao lado do rótulo e da ajuda que já estão
lá. O comentário no topo daquele arquivo conta que essa lista já esteve copiada em
cinco lugares e que uma cópia esquecida derrubou a criação de visita em produção —
razão suficiente para a cor nascer lá dentro e não num mapa novo ao lado.

Aquele módulo também já expõe `rotuloDoTipo()`, que mapeia `recorrente` para
"Manutenção". A agregação reusa essa função em vez de repetir a regra.

---

## 4. Cor

**Tipo e status não podem dividir matizes.**

A paleta atual usa cor como código de trânsito de status, e isso está documentado em
`globals.css`: `--color-fazer` azul é "a fazer", `--color-feita` verde é "realizada",
`--color-adiada` âmbar é "reagendada", `--color-morta` cinza é "cancelada".

Pintar "prospecção" de azul faria o leitor ler "a fazer" — e ele acabou de aprender
esse código na seção acima, cinco segundos antes, na mesma tela.

Os tipos recebem uma paleta categórica própria, deliberadamente distante das quatro
cores de status, declarada como tokens no `@theme` junto das demais. Os requisitos:
cinco matizes distinguíveis entre si, legíveis sob luz direta — a condição real de uso
— e que sobrevivam a daltonismo, que atinge cerca de 8% dos homens e esta é uma equipe
majoritariamente masculina em campo.

A escolha dos valores acontece na implementação, com a skill de visualização de dados
carregada. Este spec fixa a restrição, não os hexadecimais.

---

## 5. Dados

Uma consulta nova no repositório de visitas, ao lado de `resumoPorVendedor`, sem
alterar a que existe:

```
contar visitas
  onde status = 'realizada'
    e data entre <de> e <ate>
    e usuario.papel = 'vendedor'
  agrupando por tipo, usuario_id
```

O índice `idx_visita_data_status` já cobre o filtro por data e status.

O filtro por `papel = 'vendedor'` acompanha o que `resumoPorVendedor` já faz: uma
visita que um gestor fez para acompanhar a equipe não é produtividade de vendedor.
Como a seção da equipe é a soma dos vendedores, ela herda o mesmo recorte — e assim os
dois blocos da página falam do mesmo conjunto, sem divergir.

A agregação — somar, ordenar, calcular percentual — fica numa função pura, separada
da consulta, recebendo as linhas e devolvendo as fatias prontas.

---

## 6. Casos de borda

- **Nenhuma visita realizada no período:** a seção inteira não é renderizada. Cinco
  barras zeradas não informam nada e ainda sugerem que o sistema quebrou.
- **`recorrente` e `manutencao`:** `recorrente` é o nome antigo de `manutencao` e
  continua no enum porque há linhas gravadas com ele — remover valor de enum no
  Postgres exige recriar o tipo e reescrever a tabela. No gráfico os dois somam numa
  única barra rotulada "Manutenção", senão a mesma coisa aparece duas vezes. O
  `rotuloDoTipo()` de `lib/visita/tipos.ts` já faz esse mapeamento; a agregação agrupa
  pelo rótulo devolvido por ele, e a fusão sai de graça.
- **Tipo com zero visitas:** não vira linha. Só entram os tipos com pelo menos uma.
- **Vendedor sem nenhuma realizada:** o card dele não ganha a linha de tipos nem a
  expansão, porque não há o que expandir.
- **Percentuais que não somam 100:** arredondar cada fatia isoladamente pode produzir
  99% ou 101%. O percentual é exibido por fatia, sem total visível, então a soma nunca
  é confrontada na tela — mas o teste fixa o comportamento para que ninguém
  "conserte" isso depois somando errado.

---

## 7. Testes

A função de agregação é pura e testa-se direto:

- soma `recorrente` dentro de `manutencao`;
- ordena da maior fatia para a menor;
- omite tipos zerados;
- calcula percentual sobre o total de realizadas, não sobre o total de visitas;
- devolve lista vazia quando não há realizadas.

A consulta é testada contra o Postgres em memória que os testes deste projeto já
sobem, verificando que visitas de gestor e visitas não realizadas ficam de fora.

---

## 8. Fora de escopo

Considerados e descartados nesta rodada, para não voltarem por inércia:

- **Evolução no tempo** — responde "está melhorando?", que é outra pergunta.
- **Comparação entre vendedores num gráfico único** — o card por pessoa já existe.
- **Ranking de clientes e carteira abandonada** — merece tela própria.
- **Cruzar tipo com status** — inflaria o gráfico e contradiz a decisão de contar só
  as realizadas.
- **Exportação** — o painel é de leitura em tela; export é assunto da fatia de
  relatórios.
