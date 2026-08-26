'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { erroDaResposta } from '@/lib/api/cliente'
import type { VisitaDoDia } from '@/lib/visita/repositorio'
import { Reagendar } from './Reagendar'
import { Realizar } from './Realizar'
import { rotuloDoTipo } from '@/lib/visita/tipos'

/**
 * A faixa colorida à esquerda do card é o que permite ler a agenda inteira
 * sem ler uma palavra — que é como ela vai ser lida na maior parte do tempo:
 * dois segundos, no semáforo, com o celular numa mão só.
 */
const SECOES = [
  { status: 'a_fazer', titulo: 'A fazer', faixa: 'bg-fazer', vazio: 'Nenhuma visita neste dia.' },
  { status: 'realizada', titulo: 'Realizadas', faixa: 'bg-feita', vazio: null },
  { status: 'reagendada', titulo: 'Reagendadas', faixa: 'bg-adiada', vazio: null },
  { status: 'cancelada', titulo: 'Canceladas', faixa: 'bg-morta', vazio: null },
] as const

export function ListaDoDia({
  visitas,
  mostrarVendedor = false,
}: {
  visitas: VisitaDoDia[]
  mostrarVendedor?: boolean
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [reagendando, setReagendando] = useState<string | null>(null)
  const [realizando, setRealizando] = useState<string | null>(null)

  async function mudar(v: VisitaDoDia, corpo: Record<string, unknown>) {
    setOcupada(v.id)
    setErro(null)
    try {
      const r = await fetch(`/api/visitas/${v.id}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível atualizar a visita'))
        return
      }
      setRealizando(null)
      router.refresh()
    } catch {
      setErro('Sem conexão. A visita não foi atualizada.')
    } finally {
      setOcupada(null)
    }
  }

  async function reagendar(v: VisitaDoDia, data: string) {
    setOcupada(v.id)
    setErro(null)
    try {
      const r = await fetch(`/api/visitas/${v.id}/reagendar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data }),
      })
      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível reagendar a visita'))
        return
      }
      setReagendando(null)
      router.refresh()
    } catch {
      setErro('Sem conexão. A visita não foi reagendada.')
    } finally {
      setOcupada(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {erro && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {erro}
        </p>
      )}

      {SECOES.map((secao) => {
        const daSecao = visitas.filter((v) => v.status === secao.status)
        if (daSecao.length === 0 && !secao.vazio) return null

        return (
          <section key={secao.status} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <span className={`h-2 w-2 rounded-full ${secao.faixa}`} aria-hidden="true" />
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                {secao.titulo}
              </h2>
              <span className="font-display text-sm font-semibold text-slate-400">
                {daSecao.length}
              </span>
            </div>

            {daSecao.length === 0 && secao.vazio && (
              <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center">
                <p className="text-sm text-slate-500">{secao.vazio}</p>
                <Link
                  href="/visita/nova"
                  className="mt-3 inline-block rounded-xl bg-fazer px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Agendar uma visita
                </Link>
              </div>
            )}

            {daSecao.map((v) => {
              const aberta = v.status === 'a_fazer'
              return (
                <article
                  key={v.id}
                  className={`flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 ${
                    aberta ? '' : 'opacity-70'
                  }`}
                >
                  <div className={`w-1.5 shrink-0 ${secao.faixa}`} aria-hidden="true" />

                  <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                    <Link href={`/visita/${v.id}`} className="min-w-0">
                      <h3 className="truncate font-display text-xl font-semibold leading-tight">
                        {v.contatoNome}
                      </h3>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
                        <span>{rotuloDoTipo(v.tipo)}</span>
                        {mostrarVendedor && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate font-medium text-slate-600">
                              {v.vendedor}
                            </span>
                          </>
                        )}
                        {v.sincronizadoEm === null && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-adiada">não enviada ao CRM</span>
                          </>
                        )}
                      </p>
                    </Link>

                    {aberta && reagendando !== v.id && realizando !== v.id && (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => setRealizando(v.id)}
                          disabled={ocupada === v.id}
                          className="flex items-center justify-center gap-2 rounded-xl bg-feita px-4 py-3 font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                            <path d="m5 13 4 4L19 7" />
                          </svg>
                          Realizada
                        </button>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setReagendando(v.id)}
                            disabled={ocupada === v.id}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 font-semibold text-adiada ring-1 ring-inset ring-adiada/40 transition-colors hover:bg-adiada/10 disabled:opacity-50"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                              <rect x="3" y="5" width="18" height="16" rx="2" />
                              <path d="M3 10h18M8 3v4M16 3v4" />
                            </svg>
                            Reagendar
                          </button>
                          <button
                            onClick={() => mudar(v, { status: 'cancelada' })}
                            disabled={ocupada === v.id}
                            className="flex-1 rounded-xl px-3 py-2.5 font-semibold text-slate-500 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-slate-50 disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {reagendando === v.id && (
                      <Reagendar
                        dia={v.data}
                        ocupado={ocupada === v.id}
                        onEscolher={(data) => reagendar(v, data)}
                        onCancelar={() => setReagendando(null)}
                      />
                    )}

                    {realizando === v.id && (
                      <Realizar
                        dia={v.data}
                        ocupado={ocupada === v.id}
                        onConfirmar={(dados) => mudar(v, { status: 'realizada', ...dados })}
                        onCancelar={() => setRealizando(null)}
                      />
                    )}

                    {/* Fechada por engano acontece: um toque no bolso, no carro.
                        Sem desfazer, o erro vira cliente que ninguém visita
                        porque o sistema jura que já foi. */}
                    {(v.status === 'realizada' || v.status === 'cancelada') &&
                      reagendando !== v.id && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => mudar(v, { status: 'a_fazer' })}
                            disabled={ocupada === v.id}
                            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-white disabled:opacity-50"
                          >
                            Reabrir
                          </button>
                          {v.status === 'cancelada' && (
                            <button
                              onClick={() => setReagendando(v.id)}
                              disabled={ocupada === v.id}
                              className="rounded-lg px-3 py-2 text-sm font-semibold text-adiada ring-1 ring-inset ring-adiada/40 transition-colors hover:bg-adiada/10 disabled:opacity-50"
                            >
                              Reagendar
                            </button>
                          )}
                        </div>
                      )}
                  </div>
                </article>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
