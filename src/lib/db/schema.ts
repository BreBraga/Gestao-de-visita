import { pgTable, uuid, text, boolean, timestamp, date, pgEnum, index } from 'drizzle-orm/pg-core'

export const papelEnum = pgEnum('papel', ['vendedor', 'gestor'])

export const usuario = pgTable('usuario', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  /** Normalizado com DDI, sem máscara: 5521977237528. É o identificador de login. */
  telefone: text('telefone').notNull().unique(),
  email: text('email'),
  senhaHash: text('senha_hash').notNull(),
  /** Vínculo com responsibleUserId dos cards. Sem ele o vendedor não vê visita. */
  zapleUserId: uuid('zaple_user_id').notNull(),
  papel: papelEnum('papel').notNull().default('vendedor'),
  ativo: boolean('ativo').notNull().default(true),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
})

export type Usuario = typeof usuario.$inferSelect
export type NovoUsuario = typeof usuario.$inferInsert

/**
 * Tentativas de login, para o limitador do /api/login. Fica no banco e não em
 * memória porque cada requisição na Vercel pode cair numa instância diferente
 * — um contador em memória não limita coisa alguma.
 */
export const tentativaLogin = pgTable(
  'tentativa_login',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Telefone normalizado. Guardamos o alvo, nunca a senha tentada. */
    identificador: text('identificador').notNull(),
    emJanela: timestamp('em_janela', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_tentativa_identificador_janela').on(t.identificador, t.emJanela)]
)

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
