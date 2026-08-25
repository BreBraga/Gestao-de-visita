import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/lib/auth/atual'
import { buscarVisita, buscarSubstituta, historicoDoContato, db } from '@/lib/visita/repositorio'
import { hoje, formatarDia } from '@/lib/visita/datas'
import { EditarVisita } from './EditarVisita'

export const dynamic = 'force-dynamic'

const TIPOS: Record<string, string> = {
  prospeccao: 'Prospecção',
  manutencao: 'Manutenção',
  pedido: 'Pedido',
  entrega: 'Entrega',
  outro: 'Outro',
  recorrente: 'Manutenção',
}

const STATUS: Record<string, { rotulo: string; faixa: string; texto: string }> = {
  a_fazer: { rotulo: 'A fazer', faixa: 'bg-fazer', texto: 'text-fazer' },
  realizada: { rotulo: 'Realizada', faixa: 'bg-feita', texto: 'text-feita' },
  reagendada: { rotulo: 'Reagendada', faixa: 'bg-adiada', texto: 'text-adiada' },
  cancelada: { rotulo: 'Cancelada', faixa: 'bg-morta', texto: 'text-slate-500' },
}

export default async function DetalheVisita({ params }: PageProps<'/visita/[id]'>) {
  const u = await exigirUsuario()
  const { id } = await params

  const visita = await buscarVisita(db, id)
  if (!visita) notFound()
  if (u.papel !== 'gestor' && visita.usuarioId !== u.id) notFound()

  const [substituta, historico] = await Promise.all([
    visita.status === 'reagendada' ? buscarSubstituta(db, visita.id) : Promise.resolve(null),
    historicoDoContato(db, visita.contatoId, visita.id),
  ])

  // Só `a_fazer` pode estar atrasada — uma visita realizada ontem não está
  // atrasada, está feita.
  const atrasada = visita.status === 'a_fazer' && visita.data < hoje()
  const s = STATUS[visita.status]

  return (
    <div className="flex flex-col gap-5">
      <Link href="/agenda" className="text-sm font-medium text-slate-500">
        ← Voltar para a agenda
      </Link>

      <header className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
        <div className={`h-1.5 ${s.faixa}`} aria-hidden="true" />
        <div className="p-5">
          <p className={`text-xs font-bold uppercase tracking-[0.14em] ${s.texto}`}>{s.rotulo}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold leading-tight">
            {visita.contatoNome}
          </h1>
          <p className="mt-1 text-slate-500">
            {TIPOS[visita.tipo] ?? visita.tipo} · {formatarDia(visita.data)}
            {atrasada && <span className="font-semibold text-adiada"> · atrasada</span>}
          </p>

          {visita.titulo !== visita.contatoNome && (
            <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
              {visita.titulo}
            </p>
          )}
        </div>
      </header>

      {substituta && (
        <Link
          href={`/visita/${substituta.id}`}
          className="flex items-center gap-3 rounded-2xl bg-adiada/10 px-4 py-3 ring-1 ring-adiada/30"
        >
          <span className="text-sm text-slate-700">
            Esta visita foi reagendada para{' '}
            <strong className="text-adiada">{formatarDia(substituta.data)}</strong>.
            <span className="block text-slate-500">Toque para abrir a visita nova.</span>
          </span>
        </Link>
      )}

      {visita.descricao && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Motivo da visita
          </h2>
          <p className="mt-2 whitespace-pre-wrap">{visita.descricao}</p>
        </section>
      )}

      {visita.relatorio && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            O que foi tratado
          </h2>
          <p className="mt-2 whitespace-pre-wrap">{visita.relatorio}</p>
        </section>
      )}

      {visita.sincronizadoEm === null && (
        <p className="rounded-2xl bg-adiada/10 px-4 py-3 text-sm text-slate-700 ring-1 ring-adiada/30">
          Esta visita ainda não chegou ao CRM. Ela está salva aqui e o gestor pode reenviar
          pela tela da equipe.
        </p>
      )}

      <EditarVisita visita={visita} />

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Histórico deste cliente
        </h2>

        {historico.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-6 text-center text-sm text-slate-500">
            Primeira visita a este cliente.
          </p>
        )}

        {historico.map((h) => {
          const hs = STATUS[h.status]
          return (
            <Link
              key={h.id}
              href={`/visita/${h.id}`}
              className="flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70"
            >
              <div className={`w-1.5 shrink-0 ${hs.faixa}`} aria-hidden="true" />
              <div className="min-w-0 flex-1 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display font-semibold">{formatarDia(h.data)}</span>
                  <span className={`text-xs font-bold uppercase tracking-wide ${hs.texto}`}>
                    {hs.rotulo}
                  </span>
                </div>
                {h.relatorio ? (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{h.relatorio}</p>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">
                    {TIPOS[h.tipo] ?? h.tipo}
                    {h.descricao ? ` · ${h.descricao}` : ''}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
