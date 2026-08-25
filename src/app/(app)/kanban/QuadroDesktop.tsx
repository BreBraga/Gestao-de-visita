'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import type { Etapa, Visita } from '@/lib/zaple/tipos'
import { podeMover } from '@/lib/visita/regras'
import { erroDaResposta } from '@/lib/api/cliente'

function CartaoArrastavel({ visita }: { visita: Visita }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: visita.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${isDragging ? 'opacity-50' : ''}`}
    >
      <Link href={`/visita/${visita.id}`} className="font-medium leading-snug">
        {visita.titulo}
      </Link>
      <p className="mt-1 text-xs text-slate-500">
        {visita.chave}
        {visita.contatos[0] && ` · ${visita.contatos[0].nome}`}
      </p>
      {visita.atrasada && <p className="mt-1 text-xs font-medium text-red-600">Atrasada</p>}
    </div>
  )
}

function Coluna({ etapa, visitas }: { etapa: Etapa; visitas: Visita[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id })

  return (
    <section
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col gap-3 rounded-lg p-3 ${isOver ? 'bg-slate-200' : 'bg-slate-100'}`}
    >
      <h2 className="text-sm font-medium text-slate-700">
        {etapa.titulo} ({visitas.length})
      </h2>
      {visitas.map((v) => (
        <CartaoArrastavel key={v.id} visita={v} />
      ))}
    </section>
  )
}

export function QuadroDesktop({ etapas, visitas }: { etapas: Etapa[]; visitas: Visita[] }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)

  async function aoSoltar(evento: DragEndEvent) {
    const destinoId = evento.over?.id
    if (typeof destinoId !== 'string') return

    const visita = visitas.find((v) => v.id === evento.active.id)
    if (!visita || !podeMover(etapas, visita.etapaId, destinoId)) return

    setErro(null)
    try {
      const r = await fetch(`/api/visitas/${visita.id}/mover`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ etapaId: destinoId, etapaAtualId: visita.etapaId }),
      })

      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível mover a visita'))
        return
      }
      router.refresh()
    } catch {
      setErro('Sem conexão. A visita não foi movida.')
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center">
        <Link href="/visita/nova" className="ml-auto rounded bg-slate-900 px-3 py-2 text-sm text-white">
          Nova visita
        </Link>
      </div>

      {erro && (
        <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      <DndContext onDragEnd={aoSoltar}>
        <div className="flex gap-4 overflow-x-auto">
          {etapas.map((e) => (
            <Coluna key={e.id} etapa={e} visitas={visitas.filter((v) => v.etapaId === e.id)} />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
