'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Contato } from '@/lib/zaple/tipos'
import { erroDaResposta } from '@/lib/api/cliente'
import { hoje } from '@/lib/visita/datas'

const TIPOS = [
  { valor: 'prospeccao', rotulo: 'Prospecção', ajuda: 'Cliente novo' },
  { valor: 'manutencao', rotulo: 'Manutenção', ajuda: 'Cliente da carteira' },
  { valor: 'pedido', rotulo: 'Pedido', ajuda: 'Fechar compra' },
  { valor: 'entrega', rotulo: 'Entrega', ajuda: 'Levar mercadoria' },
  { valor: 'outro', rotulo: 'Outro', ajuda: 'Descreva abaixo' },
] as const

/**
 * A visita é sempre de quem está criando.
 *
 * O seletor de responsável saiu com a inversão da fonte da verdade: atribuir a
 * outra pessoa exige o par `usuarioId` + `zapleUserId`, e esta tela só conhece
 * os agentes do Zaple, não os usuários do nosso banco. Volta na Fatia B, com a
 * lista vinda de `listarUsuarios()`.
 */
export function FormNovaVisita() {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [achados, setAchados] = useState<Contato[] | null>(null)
  const [escolhido, setEscolhido] = useState<Contato | null>(null)
  const [cadastrando, setCadastrando] = useState(false)
  const [telefoneNovo, setTelefoneNovo] = useState('')
  const [titulo, setTitulo] = useState('')
  const [prazo, setPrazo] = useState('')
  const [tipo, setTipo] = useState('prospeccao')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  function escolher(c: Contato) {
    setEscolhido(c)
    setTitulo((t) => t || c.nome)
    setCadastrando(false)
  }

  async function procurar() {
    if (busca.trim().length < 2) return
    setOcupado(true)
    setErro(null)
    try {
      const r = await fetch(`/api/contatos?busca=${encodeURIComponent(busca)}`)
      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível buscar clientes'))
        return
      }
      setAchados((await r.json()).contatos)
    } catch {
      setErro('Sem conexão. Verifique a internet.')
    } finally {
      setOcupado(false)
    }
  }

  async function cadastrarContato() {
    setOcupado(true)
    setErro(null)
    try {
      const r = await fetch('/api/contatos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nome: busca.trim(), telefone: telefoneNovo }),
      })
      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível cadastrar o cliente'))
        return
      }
      escolher((await r.json()).contato)
    } catch {
      setErro('Sem conexão. O cliente não foi cadastrado.')
    } finally {
      setOcupado(false)
    }
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    if (!escolhido) {
      setErro('Escolha o cliente da visita')
      return
    }
    setOcupado(true)
    setErro(null)
    try {
      const r = await fetch('/api/visitas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          titulo,
          contatoId: escolhido.id,
          // A rota congela o nome do cliente na visita: sem ele, o dashboard
          // teria de consultar o Zaple por linha.
          contatoNome: escolhido.nome,
          data: prazo || hoje(),
          tipo,
          descricao: descricao.trim() || undefined,
        }),
      })
      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível criar a visita'))
        return
      }
      router.replace('/agenda')
      router.refresh()
    } catch {
      setErro('Sem conexão. A visita não foi criada.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form onSubmit={criar} className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">Cliente</span>

        {escolhido ? (
          <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3">
            <div>
              <p className="font-medium">{escolhido.nome}</p>
              <p className="text-sm text-slate-500">{escolhido.telefone}</p>
            </div>
            <button
              type="button"
              onClick={() => setEscolhido(null)}
              className="text-sm text-slate-600 underline"
            >
              trocar
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value)
                  setAchados(null)
                  setCadastrando(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    procurar()
                  }
                }}
                placeholder="Nome ou telefone"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3"
              />
              <button
                type="button"
                onClick={procurar}
                disabled={ocupado}
                className="rounded-lg border border-slate-300 bg-white px-4 disabled:opacity-50"
              >
                Buscar
              </button>
            </div>

            {achados && achados.length > 0 && (
              <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                {achados.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => escolher(c)} className="w-full px-4 py-3 text-left">
                      <span className="font-medium">{c.nome}</span>
                      <span className="block text-sm text-slate-500">{c.telefone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {achados && achados.length === 0 && !cadastrando && (
              <button
                type="button"
                onClick={() => setCadastrando(true)}
                className="self-start text-sm text-slate-600 underline"
              >
                Nenhum encontrado. Cadastrar &ldquo;{busca.trim()}&rdquo; como novo cliente
              </button>
            )}

            {cadastrando && (
              <div className="flex flex-col gap-2 rounded-lg border border-slate-300 bg-white p-3">
                <p className="text-sm text-slate-600">
                  Cadastrando <strong>{busca.trim()}</strong>. Falta o celular:
                </p>
                <input
                  type="tel"
                  inputMode="tel"
                  value={telefoneNovo}
                  onChange={(e) => setTelefoneNovo(e.target.value)}
                  placeholder="(21) 99999-9999"
                  className="rounded-lg border border-slate-300 px-4 py-3"
                />
                <button
                  type="button"
                  onClick={cadastrarContato}
                  disabled={ocupado || telefoneNovo.replace(/\D/g, '').length < 10}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-white disabled:opacity-50"
                >
                  {ocupado ? 'Cadastrando…' : 'Cadastrar cliente'}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Título da visita</span>
        <input
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-3"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Tipo da visita</legend>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS.map((t) => (
            <label
              key={t.valor}
              className={`flex cursor-pointer flex-col rounded-xl px-3 py-2.5 ring-1 transition-colors ${
                tipo === t.valor
                  ? 'bg-fazer/10 ring-fazer'
                  : 'bg-white ring-slate-300 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value={t.valor}
                checked={tipo === t.valor}
                onChange={(e) => setTipo(e.target.value)}
                className="sr-only"
              />
              <span className="font-semibold">{t.rotulo}</span>
              <span className="text-xs text-slate-500">{t.ajuda}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Motivo da visita (opcional)</span>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          placeholder="Ex.: Levar amostra do filtro novo. Cliente pediu orçamento para a frota inteira."
          className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 placeholder:text-slate-400"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Data da visita</span>
        <input
          required
          type="date"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-3"
        />
      </label>

      {erro && (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      )}

      <button
        disabled={ocupado}
        className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
      >
        {ocupado ? 'Salvando…' : 'Criar visita'}
      </button>
    </form>
  )
}
