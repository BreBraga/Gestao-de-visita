import { and, eq, gte, sql } from 'drizzle-orm'
import { db, tentativaLogin } from '@/lib/db'

const JANELA_MINUTOS = 15
const MAXIMO = 8

export async function registrarTentativa(identificador: string): Promise<void> {
  await db.insert(tentativaLogin).values({ identificador })
}

export async function excedeuTentativas(identificador: string): Promise<boolean> {
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000)
  const [linha] = await db
    .select({ quantas: sql<number>`count(*)::int` })
    .from(tentativaLogin)
    .where(and(eq(tentativaLogin.identificador, identificador), gte(tentativaLogin.emJanela, desde)))
  return (linha?.quantas ?? 0) >= MAXIMO
}
