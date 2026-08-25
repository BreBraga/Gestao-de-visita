// Sobe um Postgres embarcado (PGlite) falando o protocolo de rede do
// Postgres, para desenvolver e verificar o app sem depender de nuvem nem
// de Docker.
//
// Como ele fala o protocolo de verdade, o app conecta por uma URL
// postgresql:// comum e NADA no código de produção muda — o que está sendo
// exercitado é exatamente o que vai para produção.
//
//   npx tsx scripts/banco-local.mts
//   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
//
// Os dados ficam em .banco-local/ (ignorado pelo git). Apague a pasta para
// começar do zero.
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const PORTA = Number(process.env.PORTA_BANCO_LOCAL ?? 5432)

const db = await PGlite.create({ dataDir: './.banco-local' })

const servidor = new PGLiteSocketServer({
  db,
  port: PORTA,
  host: '127.0.0.1',
  // O padrão é 1 conexão sem concorrência. O postgres.js abre um pool, e as
  // conexões excedentes tomam ECONNRESET no meio da consulta.
  maxConnections: 10,
})
await servidor.start()

console.log(`Postgres local ouvindo em postgresql://postgres:postgres@localhost:${PORTA}/postgres`)
console.log('Ctrl+C para parar.')

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, async () => {
    await servidor.stop()
    await db.close()
    process.exit(0)
  })
}
