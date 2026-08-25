'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { erroDaResposta } from '@/lib/api/cliente'
import type { Visita } from '@/lib/db'

const TIPOS = [
  { valor: 'prospeccao', rotulo: 'Prospecção' },
  { valor: 'manutencao', rotulo: 'Manutenção' },
  { valor: 'pedido', rotulo: 'Pedido' },
  { valor: 'entrega', rotulo: 'Entrega' },
  { valor: 'outro', rotulo: 'Outro' },
] as const

/**
 * Editar o que ainda não aconteceu.
 *
 * A data só é editável enquanto a visita está aberta: uma visita realizada
 * aconteceu no dia em que aconteceu, e deixar mudar isso depois reescreveria
 * o histórico que o relatório do gestor lê.
 */
export function EditarVisita({ visita }: { visita: Visita }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [titulo, setTitulo] = useState(visita.titulo)
  const [descricao, setDescricao] = useState(visita.descricao ?? '')
  const [tipo, setTipo] = useState(visita.tipo)
  const [data, setData] = useState(visita.data)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const podeMudarData = visita.status === 'a_fazer'

  async function salvar() {
    setOcupado(true)
    setErro(null)
    try {
      const r = await fetch(`/api/visitas/${visita.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          titulo,
          descricao: descricao.trim() || null,
          tipo,
          ...(podeMudarData ? { data } : {}),
        }),
      })
      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível salvar'))
        return
      }
      setAberto(false)
      router.refresh()
    } catch {
      setErro('Sem conexão. As mudanças não foram salvas.')
    } finally {
      setOcupado(false)
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 self-start rounded-xl px-4 py-2.5 font-semibold text-fazer ring-1 ring-inset ring-fazer/40 transition-colors hover:bg-fazer/10"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        Editar visita
      </button>
    )
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Editar visita
        </h2>
        <button
          onClick={() => setAberto(false)}
          className="text-sm font-medium text-slate-500 underline-offset-4 hover:underline"
        >
          Cancelar
        </button>
      </div>

      {erro && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {erro}
        </p>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Título</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2.5"
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <label
              key={t.valor}
              className={`cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition-colors ${
                tipo === t.valor ? 'bg-fazer/10 ring-fazer' : 'ring-slate-300 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value={t.valor}
                checked={tipo === t.valor}
                onChange={(e) => setTipo(e.target.value as typeof tipo)}
                className="sr-only"
              />
              {t.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Motivo da visita</span>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          placeholder="O que você vai tratar com esse cliente"
          className="resize-y rounded-xl border border-slate-300 px-3 py-2.5 placeholder:text-slate-400"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Data</span>
        <input
          type="date"
          value={data}
          disabled={!podeMudarData}
          onChange={(e) => setData(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-100 disabled:text-slate-400"
        />
        {!podeMudarData && (
          <span className="text-sm text-slate-500">
            Para mudar a data, reabra a visita antes — ela aconteceu no dia em que aconteceu.
          </span>
        )}
      </label>

      <button
        onClick={salvar}
        disabled={ocupado || !titulo.trim()}
        className="rounded-xl bg-fazer px-4 py-3 font-semibold text-white disabled:opacity-40"
      >
        {ocupado ? 'Salvando…' : 'Salvar mudanças'}
      </button>
    </section>
  )
}
