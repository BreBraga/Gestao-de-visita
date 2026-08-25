import Link from 'next/link'
import { exigirUsuario } from '@/lib/auth/atual'
import { listarDoDia, db } from '@/lib/visita/repositorio'
import { hoje, formatarDia, somarDias } from '@/lib/visita/datas'
import { ListaDoDia } from './ListaDoDia'

export const dynamic = 'force-dynamic'

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** Nome do dia sem passar por fuso: a data já é só uma data. */
function porExtenso(data: string): { diaSemana: string; diaMes: string } {
  const [ano, mes, dia] = data.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  return {
    diaSemana: DIAS[d.getUTCDay()],
    diaMes: `${dia} de ${MESES[mes - 1]}`,
  }
}

export default async function Agenda({ searchParams }: PageProps<'/agenda'>) {
  const u = await exigirUsuario()
  const { data, todos } = await searchParams

  // hoje() usa o fuso de São Paulo — new Date().toISOString() viraria o dia
  // às 21h no Brasil e a agenda apareceria vazia bem na hora em que o
  // vendedor está fechando o dia.
  const dia = typeof data === 'string' ? data : hoje()
  const vendoTodos = todos === '1' && u.papel === 'gestor'
  // Preserva o filtro "ver todos" ao trocar de dia.
  const sufixoTodos = vendoTodos ? '&todos=1' : ''

  const visitas = await listarDoDia(db, { data: dia, usuarioId: vendoTodos ? undefined : u.id })

  const aFazer = visitas.filter((v) => v.status === 'a_fazer').length
  const fechadas = visitas.length - aFazer
  const progresso = visitas.length === 0 ? 0 : Math.round((fechadas / visitas.length) * 100)
  const { diaSemana, diaMes } = porExtenso(dia)
  const ehHoje = dia === hoje()

  return (
    <div className="flex flex-col gap-5">
      {/* O cabeçalho do dia responde de relance às duas perguntas do vendedor
          na rua: que dia é, e quanto falta. */}
      <section className="overflow-hidden rounded-2xl bg-asfalto text-white shadow-sm">
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
              {ehHoje ? 'Hoje' : diaSemana}
            </p>
            <h1 className="font-display text-3xl font-semibold leading-tight">{diaMes}</h1>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href={`/agenda?data=${somarDias(dia, -1)}${sufixoTodos}`}
              aria-label="Dia anterior"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg text-white/80 transition-colors hover:bg-white/20"
            >
              ‹
            </Link>
            <Link
              href={`/agenda?data=${somarDias(dia, 1)}${sufixoTodos}`}
              aria-label="Dia seguinte"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg text-white/80 transition-colors hover:bg-white/20"
            >
              ›
            </Link>
          </div>
        </div>

        <div className="flex items-baseline gap-2 px-5 pt-3">
          <span className="font-display text-2xl font-semibold">{fechadas}</span>
          <span className="text-sm text-white/60">
            de {visitas.length} {visitas.length === 1 ? 'visita' : 'visitas'}
          </span>
          {aFazer > 0 && (
            <span className="ml-auto text-sm font-medium text-white/80">
              {aFazer} {aFazer === 1 ? 'restante' : 'restantes'}
            </span>
          )}
        </div>

        {/* A barra do dia. É o instrumento: uma olhada diz quanto do dia
            já foi fechado, sem contar card nenhum. */}
        <div className="mt-3 h-1.5 w-full bg-white/10">
          <div
            className="h-full bg-feita transition-[width] duration-500"
            style={{ width: `${progresso}%` }}
          />
        </div>

        <div className="flex items-center gap-4 px-5 py-3 text-sm">
          {!ehHoje && (
            <Link href={`/agenda${vendoTodos ? '?todos=1' : ''}`} className="text-white/70 underline-offset-4 hover:underline">
              Voltar para hoje
            </Link>
          )}
          {u.papel === 'gestor' && (
            <Link
              href={`/agenda?data=${dia}${vendoTodos ? '' : '&todos=1'}`}
              className="ml-auto rounded-lg bg-white/10 px-3 py-1.5 font-medium text-white/90 transition-colors hover:bg-white/20"
            >
              {vendoTodos ? 'Só as minhas' : 'Ver a equipe'}
            </Link>
          )}
        </div>
      </section>

      <ListaDoDia visitas={visitas} mostrarVendedor={vendoTodos} />
    </div>
  )
}
