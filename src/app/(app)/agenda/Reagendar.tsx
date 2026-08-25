'use client'
import { useState } from 'react'
import { somarDias, formatarDia } from '@/lib/visita/datas'

/**
 * Reagendar em um toque, para os casos que são quase todos.
 *
 * "Cliente não estava" e "volto amanhã" é o desfecho mais comum de uma visita
 * que não aconteceu. Obrigar o vendedor a abrir um calendário e escolher a
 * data na rua, com uma mão só, transformaria dois segundos em vinte — e o que
 * custa vinte segundos por visita simplesmente não é feito.
 *
 * O calendário continua ali para o resto.
 */
export function Reagendar({
  dia,
  ocupado,
  onEscolher,
  onCancelar,
}: {
  dia: string
  ocupado: boolean
  onEscolher: (data: string) => void
  onCancelar: () => void
}) {
  const [personalizada, setPersonalizada] = useState('')

  const atalhos = [
    { rotulo: 'Amanhã', data: somarDias(dia, 1) },
    { rotulo: 'Em 2 dias', data: somarDias(dia, 2) },
    { rotulo: 'Semana que vem', data: somarDias(dia, 7) },
  ]

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Nova data
        </p>
        <button
          type="button"
          onClick={onCancelar}
          className="text-sm font-medium text-slate-500 underline-offset-4 hover:underline"
        >
          Fechar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {atalhos.map((a) => (
          <button
            key={a.data}
            type="button"
            disabled={ocupado}
            onClick={() => onEscolher(a.data)}
            className="flex flex-col items-start rounded-xl bg-white px-3 py-2 ring-1 ring-slate-300 transition-colors hover:bg-adiada/10 hover:ring-adiada disabled:opacity-50"
          >
            <span className="font-semibold">{a.rotulo}</span>
            <span className="text-xs text-slate-500">{formatarDia(a.data)}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="date"
          value={personalizada}
          min={somarDias(dia, 1)}
          onChange={(e) => setPersonalizada(e.target.value)}
          aria-label="Escolher outra data"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5"
        />
        <button
          type="button"
          disabled={ocupado || !personalizada}
          onClick={() => onEscolher(personalizada)}
          className="rounded-xl bg-adiada px-4 py-2.5 font-semibold text-white disabled:opacity-40"
        >
          {ocupado ? 'Salvando…' : 'Reagendar'}
        </button>
      </div>
    </div>
  )
}
