import { describe, it, expect } from 'vitest'
import { criarBancoDeTeste, criarUsuarioDeTeste } from './banco'
import { visita } from '@/lib/db/schema'

describe('banco de teste', () => {
  it('aplica as migrações e aceita uma visita', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    const u = await criarUsuarioDeTeste(db)

    const [v] = await db
      .insert(visita)
      .values({
        contatoId: '22222222-2222-2222-2222-222222222222',
        contatoNome: 'AUTOCAR',
        usuarioId: u.id,
        zapleUserId: u.zapleUserId,
        data: '2026-08-25',
        titulo: 'AUTOCAR',
      })
      .returning()

    expect(v.status).toBe('a_fazer')
    expect(v.tipo).toBe('prospeccao')
    expect(v.sincronizadoEm).toBeNull()
    await fechar()
  })
})
