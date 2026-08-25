'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { erroDaResposta } from '@/lib/api/cliente'
import type { Visita } from '@/lib/db'

const SECOES = [
  { status: 'a_fazer', titulo: 'A fazer' },
  { status: 'realizada', titulo: 'Realizadas' },
  { status: 'cancelada', titulo: 'Canceladas' },
  { status: 'reagendada', titulo: 'Reagendadas' },
] as const

export function ListaDoDia({ visitas }: { visitas: Visita[] }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [ocupada, setOcupada] = useState<string | null>(null)

  async function concluir(v: Visita, status: 'realizada' | 'cancelada') {
    setOcupada(v.id)
    setErro(null)
    try {
      const r = await fetch(`/api/visitas/${v.id}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível atualizar a visita'))
        return
      }
      router.refresh()
    } catch {
      setErro('Sem conexão. A visita não foi atualizada.')
    } finally {
      setOcupada(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      )}

      {SECOES.map((secao) => {
        const daSecao = visitas.filter((v) => v.status === secao.status)
        if (daSecao.length === 0 && secao.status !== 'a_fazer') return null

        return (
          <section key={secao.status} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-slate-600">
              {secao.titulo} ({daSecao.length})
            </h2>

            {daSecao.length === 0 && (
              <p className="text-sm text-slate-400">Nenhuma visita.</p>
            )}

            {daSecao.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-medium">{v.contatoNome}</p>
                  <p className="text-sm text-slate-500">
                    {v.tipo === 'recorrente' ? 'Recorrente' : 'Prospecção'}
                  </p>
                </div>

                {v.status === 'a_fazer' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => concluir(v, 'realizada')}
                      disabled={ocupada === v.id}
                      className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Realizada
                    </button>
                    <button
                      onClick={() => concluir(v, 'cancelada')}
                      disabled={ocupada === v.id}
                      className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
