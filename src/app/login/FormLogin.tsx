'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { erroDaResposta } from '@/lib/api/cliente'

export function FormLogin() {
  const router = useRouter()
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telefone, senha }),
      })
      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível entrar'))
        return
      }
      router.replace('/kanban')
      router.refresh()
    } catch {
      setErro('Sem conexão. Verifique a internet e tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Celular</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="username"
          required
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(21) 99999-9999"
          className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-base"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Senha</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-base"
        />
      </label>

      {erro && (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg bg-slate-900 px-4 py-3 text-base font-medium text-white disabled:opacity-50"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
