import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/lib/auth/atual'
import { buscarVisita, db } from '@/lib/visita/repositorio'

export const dynamic = 'force-dynamic'

function formatarData(data: Date | string | null): string {
  if (!data) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(data))
}

export default async function DetalheVisita({ params }: PageProps<'/visita/[id]'>) {
  const u = await exigirUsuario()
  const { id } = await params

  const visita = await buscarVisita(db, id)
  if (!visita) notFound()

  if (u.papel !== 'gestor' && visita.usuarioId !== u.id) notFound()

  // O Zaple calculava isto; agora a data é nossa, então a conta é aqui.
  // Só `a_fazer` pode estar atrasada — uma visita realizada ontem não está
  // atrasada, está feita.
  const hoje = new Date().toISOString().slice(0, 10)
  const atrasada = visita.status === 'a_fazer' && visita.data < hoje

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <Link href="/kanban" className="text-sm text-slate-600">
        ← Voltar
      </Link>

      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500">{visita.contatoNome}</p>
        <h1 className="text-xl font-semibold">{visita.titulo}</h1>
        <p className="mt-1 text-sm text-slate-500">{visita.status}</p>
      </header>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <div>
          <dt className="text-slate-500">Cliente</dt>
          <dd className="font-medium">{visita.contatoNome}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Data</dt>
          <dd className={atrasada ? 'font-medium text-red-600' : 'font-medium'}>
            {formatarData(visita.data)}
            {atrasada && ' · atrasada'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Criada em</dt>
          <dd className="font-medium">{formatarData(visita.criadaEm)}</dd>
        </div>
      </dl>

      {visita.relatorio && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-500">Relatório</h2>
          <p className="whitespace-pre-wrap text-sm">{visita.relatorio}</p>
        </section>
      )}

      {/* O botão "Registrar visita" chega na Fatia 2, junto com o checklist. */}
    </div>
  )
}
