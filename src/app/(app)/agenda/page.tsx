import Link from 'next/link'
import { exigirUsuario } from '@/lib/auth/atual'
import { listarDoDia, db } from '@/lib/visita/repositorio'
import { hoje, formatarDia, somarDias } from '@/lib/visita/datas'
import { ListaDoDia } from './ListaDoDia'

export const dynamic = 'force-dynamic'

export default async function Agenda({ searchParams }: PageProps<'/agenda'>) {
  const u = await exigirUsuario()
  const { data, todos } = await searchParams

  // hoje() usa o fuso de São Paulo — new Date().toISOString() viraria o dia
  // às 21h no Brasil e a agenda apareceria vazia bem na hora em que o
  // vendedor está fechando o dia.
  const dia = typeof data === 'string' ? data : hoje()
  const vendoTodos = todos === '1' && u.papel === 'gestor'
  // Preserva o filtro "ver todos" ao trocar de dia — sem isto o gestor
  // perde o filtro toda vez que vira a página.
  const sufixoTodos = vendoTodos ? '&todos=1' : ''

  const visitas = await listarDoDia(db, { data: dia, usuarioId: vendoTodos ? undefined : u.id })

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/agenda?data=${somarDias(dia, -1)}${sufixoTodos}`}
          aria-label="Dia anterior"
          className="rounded border border-slate-300 px-3 py-2"
        >
          ‹
        </Link>

        <h1 className="text-lg font-semibold">{formatarDia(dia)}</h1>

        <Link
          href={`/agenda?data=${somarDias(dia, 1)}${sufixoTodos}`}
          aria-label="Dia seguinte"
          className="rounded border border-slate-300 px-3 py-2"
        >
          ›
        </Link>

        {dia !== hoje() && (
          <Link href={`/agenda${vendoTodos ? '?todos=1' : ''}`} className="text-sm text-slate-600 underline">
            Hoje
          </Link>
        )}

        {u.papel === 'gestor' && (
          <Link
            href={`/agenda?data=${dia}${vendoTodos ? '' : '&todos=1'}`}
            className="text-sm text-slate-600 underline"
          >
            {vendoTodos ? 'Ver só as minhas' : 'Ver todos'}
          </Link>
        )}
        <Link href="/visita/nova" className="ml-auto rounded bg-slate-900 px-3 py-2 text-sm text-white">
          Nova visita
        </Link>
      </div>

      <ListaDoDia visitas={visitas} />
    </div>
  )
}
