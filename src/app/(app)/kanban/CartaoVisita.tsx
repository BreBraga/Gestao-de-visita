'use client'
import Link from 'next/link'
import type { Visita } from '@/lib/zaple/tipos'

function formatarPrazo(iso: string | null): string | null {
  if (!iso) return null
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(iso))
}

export function CartaoVisita({
  visita,
  rotuloProxima,
  onAvancar,
  movendo,
}: {
  visita: Visita
  rotuloProxima: string | null
  onAvancar: () => void
  movendo: boolean
}) {
  const prazo = formatarPrazo(visita.prazo)

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <Link href={`/visita/${visita.id}`} className="block">
        <h3 className="font-medium leading-snug">{visita.titulo}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {visita.chave}
          {visita.contatos[0] && ` · ${visita.contatos[0].nome}`}
        </p>
        {prazo && (
          <p className={`mt-1 text-xs ${visita.atrasada ? 'font-medium text-red-600' : 'text-slate-500'}`}>
            {visita.atrasada ? 'Atrasada — ' : ''}
            {prazo}
          </p>
        )}
      </Link>

      {rotuloProxima && (
        <button
          onClick={onAvancar}
          disabled={movendo}
          className="mt-3 w-full rounded border border-slate-300 py-2 text-sm font-medium disabled:opacity-50"
        >
          {movendo ? 'Movendo…' : `Avançar para ${rotuloProxima}`}
        </button>
      )}
    </article>
  )
}
