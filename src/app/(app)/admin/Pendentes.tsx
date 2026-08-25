'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { erroDaResposta } from '@/lib/api/cliente'

export function Pendentes({ quantidade }: { quantidade: number }) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)

  async function reprocessar() {
    setOcupado(true)
    setErro(null)
    try {
      const r = await fetch('/api/sincronismo', { method: 'POST' })
      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível reprocessar'))
        return
      }
      const { tentadas, sincronizadas } = await r.json()
      setResultado(`${sincronizadas} de ${tentadas} foram para o Zaple.`)
      router.refresh()
    } catch {
      setErro('Sem conexão. Nada foi reprocessado.')
    } finally {
      setOcupado(false)
    }
  }

  if (quantidade === 0) return null

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm">
        <strong>{quantidade}</strong>{' '}
        {quantidade === 1 ? 'visita não chegou' : 'visitas não chegaram'} ao Zaple. Elas estão
        salvas aqui e o vendedor não foi afetado.
      </p>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {resultado && <p className="text-sm text-slate-700">{resultado}</p>}
      <button
        onClick={reprocessar}
        disabled={ocupado}
        className="self-start rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {ocupado ? 'Enviando…' : 'Tentar de novo'}
      </button>
    </section>
  )
}
