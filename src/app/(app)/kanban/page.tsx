import { exigirUsuario } from '@/lib/auth/atual'
import { listarEtapas } from '@/lib/zaple/painel'
import { listarVisitas } from '@/lib/zaple/visitas'
import { Quadro } from './Quadro'
import { QuadroDesktop } from './QuadroDesktop'

export const dynamic = 'force-dynamic'

export default async function Kanban({ searchParams }: PageProps<'/kanban'>) {
  const u = await exigirUsuario()
  const { todos } = await searchParams
  const vendoTodos = todos === '1' && u.papel === 'gestor'

  const [etapas, pagina] = await Promise.all([
    listarEtapas(),
    listarVisitas({ responsavelId: vendoTodos ? undefined : u.zapleUserId }),
  ])

  // Os dois quadros são renderizados e escondidos por CSS, em vez de detectar
  // a largura em JavaScript: detecção por JS causa um salto visível no
  // primeiro render, e este é o app que o vendedor abre vinte vezes por dia.
  return (
    <>
      <div className="lg:hidden">
        <Quadro
          etapas={etapas}
          visitas={pagina.itens}
          podeVerTodos={u.papel === 'gestor'}
          vendoTodos={vendoTodos}
        />
      </div>
      <div className="hidden lg:block">
        <QuadroDesktop etapas={etapas} visitas={pagina.itens} />
      </div>
    </>
  )
}
