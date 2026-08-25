import type { Config } from 'drizzle-kit'

/**
 * A migração usa a conexão direta, não o pooler. O pooler de transação do
 * Supabase não sustenta bem DDL nem os locks que o drizzle-kit usa para
 * garantir que duas migrações não rodem ao mesmo tempo.
 */
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: url! },
} satisfies Config
