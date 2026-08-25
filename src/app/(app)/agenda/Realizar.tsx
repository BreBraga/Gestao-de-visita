'use client'
import { useState } from 'react'
import { somarDias, formatarDia } from '@/lib/visita/datas'

/**
 * O fecho da visita: o que foi tratado, e quando é o retorno.
 *
 * As duas coisas ficam na mesma tela porque acontecem no mesmo momento — o
 * vendedor sai do cliente sabendo as duas. Separar em dois passos garantiria
 * que o segundo não fosse preenchido, e é justamente o retorno que faz o
 * cliente ser visitado de novo em vez de esquecido.
 */
export function Realizar({
  dia,
  ocupado,
  onConfirmar,
  onCancelar,
}: {
  dia: string
  ocupado: boolean
  onConfirmar: (dados: { relatorio: string; proximaVisita?: { data: string; descricao?: string } }) => void
  onCancelar: () => void
}) {
  const [relatorio, setRelatorio] = useState('')
  const [querRetorno, setQuerRetorno] = useState(false)
  const [dataRetorno, setDataRetorno] = useState(somarDias(dia, 30))
  const [motivoRetorno, setMotivoRetorno] = useState('')

  const podeSalvar = relatorio.trim().length > 0 && (!querRetorno || !!dataRetorno)

  const atalhos = [
    { rotulo: '15 dias', data: somarDias(dia, 15) },
    { rotulo: '30 dias', data: somarDias(dia, 30) },
    { rotulo: '60 dias', data: somarDias(dia, 60) },
  ]

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Fechar visita
        </p>
        <button
          type="button"
          onClick={onCancelar}
          className="text-sm font-medium text-slate-500 underline-offset-4 hover:underline"
        >
          Fechar
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">
          O que foi tratado com o cliente?
        </span>
        <textarea
          value={relatorio}
          onChange={(e) => setRelatorio(e.target.value)}
          rows={4}
          autoFocus
          placeholder="Ex.: Apresentei a linha de filtros. Comprou 3 unidades para teste. Frota de 15 carros, tem interesse em contrato mensal."
          className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base placeholder:text-slate-400"
        />
      </label>

      <div className="flex flex-col gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={querRetorno}
            onChange={(e) => setQuerRetorno(e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 accent-fazer"
          />
          <span className="text-sm font-semibold">Agendar o próximo retorno</span>
        </label>

        {querRetorno && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {atalhos.map((a) => (
                <button
                  key={a.data}
                  type="button"
                  onClick={() => setDataRetorno(a.data)}
                  className={`flex flex-col items-start rounded-xl px-3 py-2 ring-1 transition-colors ${
                    dataRetorno === a.data
                      ? 'bg-fazer/10 ring-fazer'
                      : 'bg-white ring-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-semibold">{a.rotulo}</span>
                  <span className="text-xs text-slate-500">{formatarDia(a.data)}</span>
                </button>
              ))}
            </div>

            <input
              type="date"
              value={dataRetorno}
              min={somarDias(dia, 1)}
              onChange={(e) => setDataRetorno(e.target.value)}
              aria-label="Data do retorno"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5"
            />

            <input
              value={motivoRetorno}
              onChange={(e) => setMotivoRetorno(e.target.value)}
              placeholder="O que esperar dessa próxima visita (opcional)"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 placeholder:text-slate-400"
            />
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={ocupado || !podeSalvar}
        onClick={() =>
          onConfirmar({
            relatorio: relatorio.trim(),
            proximaVisita: querRetorno
              ? { data: dataRetorno, descricao: motivoRetorno.trim() || undefined }
              : undefined,
          })
        }
        className="flex items-center justify-center gap-2 rounded-xl bg-feita px-4 py-3 font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="m5 13 4 4L19 7" />
        </svg>
        {ocupado ? 'Salvando…' : 'Confirmar visita realizada'}
      </button>

      {!relatorio.trim() && (
        <p className="text-center text-sm text-slate-500">
          O resumo é obrigatório — é ele que vira o histórico do cliente.
        </p>
      )}
    </div>
  )
}
