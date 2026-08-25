import { criarVisita as criarCardZaple, moverEtapa, gravarNota } from '@/lib/zaple/visitas'
import { listarEtapas } from '@/lib/zaple/painel'
import { marcarSincronizada, marcarCard, type BancoVisita } from './repositorio'
import { etapaParaStatus } from './etapas'
import type { Visita } from '@/lib/db'

/**
 * Espelha a visita no Zaple. **Nunca lança.**
 *
 * Esta é a inversão inteira em uma função: o dado já está salvo no nosso
 * Postgres quando isto roda. Se o Zaple recusar, estiver fora do ar ou tiver
 * o painel configurado de um jeito que não esperávamos, o resultado é uma
 * visita com `sincronizado_em` nulo — nunca um vendedor na rua sem conseguir
 * registrar o que acabou de fazer.
 */
export async function sincronizar(
  db: BancoVisita,
  v: Visita
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const etapas = await listarEtapas()
    let cardId = v.cardId

    if (!cardId) {
      const etapaInicial = etapaParaStatus(etapas, 'a_fazer') ?? etapas.find((e) => e.inicial)
      if (!etapaInicial) return { ok: false, erro: 'O painel do Zaple não tem etapa inicial.' }

      const card = await criarCardZaple({
        etapaId: etapaInicial.id,
        titulo: v.titulo,
        responsavelId: v.zapleUserId,
        contatoIds: [v.contatoId],
        // Meio-dia UTC: com 00:00 o fuso do Brasil empurraria o card para o
        // dia anterior no Zaple.
        prazo: `${v.data}T12:00:00.000Z`,
      })
      cardId = card.id
      // Persistir agora, e não só no fim: se a nota ou a movimentação falhar,
      // a próxima tentativa reusa este card em vez de criar outro.
      await marcarCard(db, v.id, cardId)
    }

    // Só grava se o texto mudou desde a última vez que chegou lá.
    const notaMudou = !!v.relatorio && v.relatorio !== v.relatorioNoZaple
    if (notaMudou) await gravarNota(cardId, v.relatorio!)

    // A etapa pode não existir: o painel é configurado por gente, e enquanto
    // não for renomeado não há "Cancelada" lá. Não mover é aceitável; travar
    // o sincronismo por causa disso não é.
    //
    // `a_fazer` não move porque o card nasce na etapa inicial — mover para
    // onde ele já está seria uma chamada à toa a cada sincronismo.
    const destino = etapaParaStatus(etapas, v.status)
    if (destino && v.status !== 'a_fazer') {
      await moverEtapa(cardId, destino.id)
    }

    await marcarSincronizada(db, v.id, cardId, notaMudou ? v.relatorio : undefined)
    return { ok: true }
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'Falha ao falar com o Zaple' }
  }
}
