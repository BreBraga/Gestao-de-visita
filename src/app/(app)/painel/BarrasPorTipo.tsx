import type { FatiaTipo } from '@/lib/visita/painel-tipos'

/**
 * Barras horizontais, uma por tipo.
 *
 * A largura é o percentual do total, não o tamanho relativo à maior fatia: se
 * a barra de 40% ocupasse a largura toda, o desenho contradiria o número
 * impresso ao lado dele.
 *
 * Sem legenda de propósito — é uma cor só, e cada barra se identifica pelo
 * próprio rótulo.
 */
export function BarrasPorTipo({
  fatias,
  compacto = false,
}: {
  fatias: FatiaTipo[]
  compacto?: boolean
}) {
  if (fatias.length === 0) return null

  return (
    <ul className={compacto ? 'flex flex-col gap-1.5' : 'flex flex-col gap-2.5'}>
      {fatias.map((f) => (
        <li key={f.rotulo} className="flex items-center gap-3">
          <span
            className={`shrink-0 truncate text-slate-600 ${
              compacto ? 'w-20 text-xs' : 'w-24 text-sm'
            }`}
          >
            {f.rotulo}
          </span>

          <div
            className={`flex-1 overflow-hidden rounded-full bg-slate-100 ${
              compacto ? 'h-1.5' : 'h-2.5'
            }`}
          >
            <div className="h-full rounded-full bg-tipo" style={{ width: `${f.percentual}%` }} />
          </div>

          <span
            className={`shrink-0 text-right tabular-nums text-slate-500 ${
              compacto ? 'w-14 text-xs' : 'w-16 text-sm'
            }`}
          >
            <span className="font-display font-semibold text-slate-800">{f.total}</span>{' '}
            {f.percentual}%
          </span>
        </li>
      ))}
    </ul>
  )
}
