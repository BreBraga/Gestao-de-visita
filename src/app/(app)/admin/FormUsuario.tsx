'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Agente } from '@/lib/zaple/tipos'
import { erroDaResposta } from '@/lib/api/cliente'

export function FormUsuario({ agentes }: { agentes: Agente[] }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formulario = e.currentTarget
    setEnviando(true)
    setErro(null)

    const dados = Object.fromEntries(new FormData(formulario))

    const r = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...dados, email: dados.email || null }),
    })

    setEnviando(false)
    if (!r.ok) {
      setErro(await erroDaResposta(r, 'Não foi possível cadastrar'))
      return
    }
    formulario.reset()
    router.refresh()
  }

  return (
    <form
      onSubmit={enviar}
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
    >
      <input name="nome" required placeholder="Nome" className="rounded border border-slate-300 px-3 py-2" />
      <input name="telefone" required placeholder="Celular" className="rounded border border-slate-300 px-3 py-2" />
      <input name="email" type="email" placeholder="E-mail (opcional)" className="rounded border border-slate-300 px-3 py-2" />
      <input
        name="senha"
        required
        minLength={8}
        type="password"
        placeholder="Senha (mín. 8)"
        className="rounded border border-slate-300 px-3 py-2"
      />

      <select name="zapleUserId" required defaultValue="" className="rounded border border-slate-300 px-3 py-2">
        <option value="" disabled>
          Agente no Zaple…
        </option>
        {/* value é o userId, não o id do agente: é o userId que os cards trazem. */}
        {agentes.map((a) => (
          <option key={a.userId} value={a.userId}>
            {a.nome}
          </option>
        ))}
      </select>

      <select name="papel" defaultValue="vendedor" className="rounded border border-slate-300 px-3 py-2">
        <option value="vendedor">Vendedor</option>
        <option value="gestor">Gestor</option>
      </select>

      {erro && (
        <p role="alert" className="text-sm text-red-600 sm:col-span-2">
          {erro}
        </p>
      )}

      <button
        disabled={enviando}
        className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50 sm:col-span-2"
      >
        {enviando ? 'Cadastrando…' : 'Cadastrar vendedor'}
      </button>
    </form>
  )
}
