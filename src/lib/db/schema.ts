import { pgTable, uuid, text, boolean, timestamp, pgEnum, index } from 'drizzle-orm/pg-core'

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
