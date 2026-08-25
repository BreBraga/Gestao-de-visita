'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Etapa, Visita } from '@/lib/zaple/tipos'
import { proximaEtapa } from '@/lib/visita/regras'
import { CartaoVisita } from './CartaoVisita'
import { erroDaResposta } from '@/lib/api/cliente'

export function Quadro({
  etapas,
  visitas,
  podeVerTodos,
  vendoTodos,
}: {
  etapas: Etapa[]
  visitas: Visita[]
  podeVerTodos: boolean
  vendoTodos: boolean
}) {
  const router = useRouter()
  const [etapaAtiva, setEtapaAtiva] = useState(etapas[0]?.id ?? '')
  const [movendoId, setMovendoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [, iniciarTransicao] = useTransition()

  async function avancar(visita: Visita) {
    const destino = proximaEtapa(etapas, visita.etapaId)
    if (!destino) return
    setMovendoId(visita.id)
    setErro(null)

    try {
      const r = await fetch(`/api/visitas/${visita.id}/mover`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ etapaId: destino.id, etapaAtualId: visita.etapaId }),
      })

      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível mover a visita'))
        return
      }
      iniciarTransicao(() => router.refresh())
    } catch {
      setErro('Sem conexão. A visita não foi movida.')
    } finally {
      setMovendoId(null)
    }
  }

  const daEtapa = visitas.filter((v) => v.etapaId === etapaAtiva)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        {podeVerTodos && (
          <Link href={vendoTodos ? '/kanban' : '/kanban?todos=1'} className="text-sm text-slate-600 underline">
            {vendoTodos ? 'Ver só as minhas' : 'Ver todos'}
          </Link>
        )}
        <Link href="/visita/nova" className="ml-auto rounded bg-slate-900 px-3 py-2 text-sm text-white">
          Nova visita
        </Link>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Etapas">
        {etapas.map((e) => {
          const quantidade = visitas.filter((v) => v.etapaId === e.id).length
          const ativa = e.id === etapaAtiva
          return (
            <button
              key={e.id}
              onClick={() => setEtapaAtiva(e.id)}
              aria-current={ativa}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                ativa ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {e.titulo} ({quantidade})
            </button>
          )
        })}
      </nav>

      {erro && (
        <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      {daEtapa.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">Nenhuma visita nesta etapa.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {daEtapa.map((v) => (
            <CartaoVisita
              key={v.id}
              visita={v}
              rotuloProxima={proximaEtapa(etapas, v.etapaId)?.titulo ?? null}
              onAvancar={() => avancar(v)}
              movendo={movendoId === v.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
