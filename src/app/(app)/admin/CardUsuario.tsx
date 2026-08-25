'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { erroDaResposta } from '@/lib/api/cliente'
import type { Agente } from '@/lib/zaple/tipos'

type UsuarioVisivel = {
  id: string
  nome: string
  telefone: string
  email: string | null
  zapleUserId: string
  papel: 'vendedor' | 'gestor'
  ativo: boolean
}

/** (21) 97723-7528 a partir de 5521977237528 — o número como as pessoas leem. */
function comMascara(telefone: string): string {
  const d = telefone.replace(/\D/g, '').replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return telefone
}

export function CardUsuario({
  usuario,
  agentes,
  souEu,
}: {
  usuario: UsuarioVisivel
  agentes: Agente[]
  souEu: boolean
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState(usuario.nome)
  const [telefone, setTelefone] = useState(comMascara(usuario.telefone))
  const [zapleUserId, setZapleUserId] = useState(usuario.zapleUserId)
  const [papel, setPapel] = useState(usuario.papel)
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const agente = agentes.find((a) => a.userId === usuario.zapleUserId)

  async function enviar(patch: Record<string, unknown>) {
    setOcupado(true)
    setErro(null)
    try {
      const r = await fetch(`/api/usuarios/${usuario.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível salvar'))
        return false
      }
      router.refresh()
      return true
    } catch {
      setErro('Sem conexão. As mudanças não foram salvas.')
      return false
    } finally {
      setOcupado(false)
    }
  }

  async function salvar() {
    const ok = await enviar({
      nome,
      telefone,
      zapleUserId,
      papel,
      ...(senha ? { senha } : {}),
    })
    if (ok) {
      setSenha('')
      setAberto(false)
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold">{usuario.nome}</h3>
            <span
              className={`rounded-lg px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
                usuario.papel === 'gestor'
                  ? 'bg-fazer/10 text-fazer'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {usuario.papel}
            </span>
            {!usuario.ativo && (
              <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                inativo
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {comMascara(usuario.telefone)} · Zaple: {agente?.nome ?? 'agente removido'}
          </p>
        </div>

        <button
          onClick={() => setAberto(!aberto)}
          className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-fazer ring-1 ring-inset ring-fazer/40 transition-colors hover:bg-fazer/10"
        >
          {aberto ? 'Fechar' : 'Editar'}
        </button>
      </div>

      {aberto && (
        <div className="flex flex-col gap-4 border-t border-slate-100 bg-slate-50 p-4">
          {erro && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {erro}
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Nome</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Telefone (é o login)</span>
            <input
              type="tel"
              inputMode="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Agente no Zaple</span>
            <select
              value={zapleUserId}
              onChange={(e) => setZapleUserId(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5"
            >
              {!agente && (
                <option value={usuario.zapleUserId}>
                  Agente removido do Zaple — escolha outro
                </option>
              )}
              {agentes.map((a) => (
                <option key={a.userId} value={a.userId}>
                  {a.nome}
                </option>
              ))}
            </select>
            <span className="text-sm text-slate-500">
              É o vínculo que faz as visitas dele aparecerem no CRM.
            </span>
          </label>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Papel</legend>
            <div className="flex gap-2">
              {(['vendedor', 'gestor'] as const).map((p) => (
                <label
                  key={p}
                  className={`flex-1 cursor-pointer rounded-xl px-3 py-2.5 text-center font-semibold capitalize ring-1 transition-colors ${
                    papel === p ? 'bg-fazer/10 ring-fazer' : 'bg-white ring-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name={`papel-${usuario.id}`}
                    value={p}
                    checked={papel === p}
                    onChange={() => setPapel(p)}
                    className="sr-only"
                  />
                  {p}
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Gestor vê o painel, a equipe e as visitas de todo mundo — e não entra nas
              métricas de vendedor.
            </p>
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Nova senha (opcional)</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Deixe em branco para manter a atual"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 placeholder:text-slate-400"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={salvar}
              disabled={ocupado || !nome.trim()}
              className="flex-1 rounded-xl bg-fazer px-4 py-3 font-semibold text-white disabled:opacity-40"
            >
              {ocupado ? 'Salvando…' : 'Salvar'}
            </button>

            {/* Desativar em vez de apagar: o histórico de visitas dele continua
                valendo, e apagar a linha levaria junto o passado da carteira. */}
            {!souEu && (
              <button
                onClick={() => enviar({ ativo: !usuario.ativo })}
                disabled={ocupado}
                className="rounded-xl px-4 py-3 font-semibold text-slate-500 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-white disabled:opacity-50"
              >
                {usuario.ativo ? 'Desativar' : 'Reativar'}
              </button>
            )}
          </div>

          {souEu && (
            <p className="text-sm text-slate-500">
              Este é o seu acesso. Você não pode se desativar nem virar vendedor por aqui.
            </p>
          )}
        </div>
      )}
    </article>
  )
}
