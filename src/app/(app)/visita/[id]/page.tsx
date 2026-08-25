import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/lib/auth/atual'
import { obterVisita } from '@/lib/zaple/visitas'
import { ZapleError } from '@/lib/zaple/erros'

export const dynamic = 'force-dynamic'

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(iso))
}

export default async function DetalheVisita({ params }: PageProps<'/visita/[id]'>) {
  const u = await exigirUsuario()
  const { id } = await params

  let visita
  try {
    visita = await obterVisita(id)
  } catch (erro) {
    if (erro instanceof ZapleError && erro.naoEncontrado) notFound()
    throw erro
  }

  if (u.papel !== 'gestor' && visita.responsavelId !== u.zapleUserId) notFound()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <Link href="/kanban" className="text-sm text-slate-600">
        ← Voltar
      </Link>

      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500">{visita.chave}</p>
        <h1 className="text-xl font-semibold">{visita.titulo}</h1>
        <p className="mt-1 text-sm text-slate-500">{visita.etapaTitulo}</p>
      </header>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <div>
          <dt className="text-slate-500">Cliente</dt>
          <dd className="font-medium">{visita.contatos[0]?.nome ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Responsável</dt>
          <dd className="font-medium">{visita.responsavelNome ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Prazo</dt>
          <dd className={visita.atrasada ? 'font-medium text-red-600' : 'font-medium'}>
            {formatarData(visita.prazo)}
            {visita.atrasada && ' · atrasada'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Criada em</dt>
          <dd className="font-medium">{formatarData(visita.criadaEm)}</dd>
        </div>
      </dl>

      {visita.descricao && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-500">Observações</h2>
          <p className="whitespace-pre-wrap text-sm">{visita.descricao}</p>
        </section>
      )}

      {/* O botão "Registrar visita" chega na Fatia 2, junto com o checklist. */}
    </div>
  )
}
