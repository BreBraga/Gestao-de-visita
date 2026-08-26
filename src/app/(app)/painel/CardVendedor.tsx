'use client'
import { useId, useState } from 'react'
import type { FatiaTipo } from '@/lib/visita/painel-tipos'
// `import type` não é estilo, é necessidade: este é Client Component, e um
// import comum de `repositorio` arrastaria o Drizzle e o driver do Postgres
// para o pacote que vai ao navegador. Com `import type` o TypeScript apaga a
// linha na compilação e nada de servidor atravessa.
import type { LinhaPainel } from '@/lib/visita/repositorio'
import { BarrasPorTipo } from './BarrasPorTipo'

export function CardVendedor({ linha, fatias }: { linha: LinhaPainel; fatias: FatiaTipo[] }) {
  const [aberto, setAberto] = useState(false)
  const idDetalhe = useId()

  const fechadas = linha.realizadas + linha.canceladas
  const pct = fechadas === 0 ? 0 : Math.round((linha.realizadas / fechadas) * 100)
  const totalStatus = linha.realizadas + linha.aFazer + linha.canceladas + linha.reagendadas

  const resumo = fatias.map((f) => `${f.rotulo} ${f.total}`).join(' · ')

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="truncate font-display text-lg font-semibold">{linha.vendedor}</h3>
        <span className="shrink-0 font-display text-lg font-semibold text-feita">
          {linha.realizadas}
        </span>
      </div>

      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
        {/* A barra é a distribuição real do trabalho dele, não um enfeite:
            cada faixa é uma fatia dos status no período. */}
        <Faixa n={linha.realizadas} de={totalStatus} cor="bg-feita" />
        <Faixa n={linha.aFazer} de={totalStatus} cor="bg-fazer" />
        <Faixa n={linha.reagendadas} de={totalStatus} cor="bg-adiada" />
        <Faixa n={linha.canceladas} de={totalStatus} cor="bg-morta" />
      </div>

      <p className="mt-2 text-sm text-slate-500">
        {linha.aFazer} a fazer · {linha.reagendadas} reagendadas · {linha.canceladas} canceladas
        {fechadas > 0 && ` · ${pct}% de conclusão`}
      </p>

      {/* Sem realizadas não há tipos para mostrar, e um botão que abre o vazio
          é pior do que botão nenhum. */}
      {fatias.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            aria-controls={idDetalhe}
            className="mt-1 flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm text-slate-600"
          >
            <span className="truncate">{resumo}</span>
            <span
              aria-hidden
              className={`shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`}
            >
              ▾
            </span>
          </button>

          {aberto && (
            <div id={idDetalhe} className="mt-2 border-t border-slate-100 pt-3">
              <BarrasPorTipo fatias={fatias} compacto />
            </div>
          )}
        </>
      )}
    </article>
  )
}

function Faixa({ n, de, cor }: { n: number; de: number; cor: string }) {
  if (n === 0 || de === 0) return null
  return <div className={cor} style={{ width: `${(n / de) * 100}%` }} />
}
