import Link from 'next/link'
import { exigirGestor } from '@/lib/auth/atual'
import {
  resumoPorVendedor,
  listarNaoSincronizadas,
  contagemPorTipo,
  db,
} from '@/lib/visita/repositorio'
import { fatiasPorTipo } from '@/lib/visita/painel-tipos'
import { BarrasPorTipo } from './BarrasPorTipo'
import { CardVendedor } from './CardVendedor'
import { hoje, somarDias, formatarDia } from '@/lib/visita/datas'

export const dynamic = 'force-dynamic'

const PERIODOS = [
  { dias: 0, rotulo: 'Hoje' },
  { dias: 6, rotulo: '7 dias' },
  { dias: 29, rotulo: '30 dias' },
] as const

export default async function Painel({ searchParams }: PageProps<'/painel'>) {
  await exigirGestor()
  const { periodo } = await searchParams

  const dias = Number(typeof periodo === 'string' ? periodo : 0)
  const diasValidos = PERIODOS.some((p) => p.dias === dias) ? dias : 0
  const ate = hoje()
  const de = somarDias(ate, -diasValidos)

  const [linhas, pendentes, contagens] = await Promise.all([
    resumoPorVendedor(db, de, ate),
    listarNaoSincronizadas(db),
    contagemPorTipo(db, de, ate),
  ])

  const fatiasDaEquipe = fatiasPorTipo(contagens)

  const total = linhas.reduce(
    (acc, l) => ({
      aFazer: acc.aFazer + l.aFazer,
      realizadas: acc.realizadas + l.realizadas,
      canceladas: acc.canceladas + l.canceladas,
      reagendadas: acc.reagendadas + l.reagendadas,
    }),
    { aFazer: 0, realizadas: 0, canceladas: 0, reagendadas: 0 }
  )
  const fechadas = total.realizadas + total.canceladas
  const conclusao = fechadas === 0 ? 0 : Math.round((total.realizadas / fechadas) * 100)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Painel</h1>
        <p className="text-sm text-slate-500">
          {diasValidos === 0 ? formatarDia(ate) : `${formatarDia(de)} a ${formatarDia(ate)}`}
        </p>
      </div>

      <div className="flex gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.dias}
            href={`/painel?periodo=${p.dias}`}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              p.dias === diasValidos
                ? 'bg-asfalto text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {p.rotulo}
          </Link>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-3">
        <Numero valor={total.realizadas} rotulo="Realizadas" cor="text-feita" destaque />
        <Numero valor={total.aFazer} rotulo="A fazer" cor="text-fazer" destaque />
        <Numero valor={total.reagendadas} rotulo="Reagendadas" cor="text-adiada" />
        <Numero valor={total.canceladas} rotulo="Canceladas" cor="text-slate-400" />
      </section>

      {fechadas > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Taxa de conclusão
            </h2>
            <span className="font-display text-2xl font-semibold text-feita">{conclusao}%</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {total.realizadas} realizadas de {fechadas} visitas fechadas.
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-feita" style={{ width: `${conclusao}%` }} />
          </div>
        </section>
      )}

      {fatiasDaEquipe.length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Por tipo
          </h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">
            {total.realizadas} {total.realizadas === 1 ? 'visita realizada' : 'visitas realizadas'}{' '}
            no período.
          </p>
          <BarrasPorTipo fatias={fatiasDaEquipe} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Por vendedor
        </h2>

        {linhas.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">
            Nenhuma visita no período.
          </p>
        )}

        {linhas.map((l) => (
          <CardVendedor
            key={l.usuarioId}
            linha={l}
            fatias={fatiasPorTipo(contagens.filter((c) => c.usuarioId === l.usuarioId))}
          />
        ))}
      </section>

      {pendentes.length > 0 && (
        <Link
          href="/admin"
          className="flex items-center gap-3 rounded-2xl bg-adiada/10 px-4 py-3 ring-1 ring-adiada/30"
        >
          <span className="font-display text-2xl font-semibold text-adiada">
            {pendentes.length}
          </span>
          <span className="text-sm text-slate-700">
            {pendentes.length === 1 ? 'visita não chegou' : 'visitas não chegaram'} ao CRM.
            <span className="block text-slate-500">Toque para reprocessar.</span>
          </span>
        </Link>
      )}
    </div>
  )
}

function Numero({
  valor,
  rotulo,
  cor,
  destaque = false,
}: {
  valor: number
  rotulo: string
  cor: string
  destaque?: boolean
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
      <p className={`font-display font-semibold ${cor} ${destaque ? 'text-4xl' : 'text-3xl'}`}>
        {valor}
      </p>
      <p className="text-sm text-slate-500">{rotulo}</p>
    </div>
  )
}
