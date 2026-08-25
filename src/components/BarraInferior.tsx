'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * A navegação principal, no rodapé.
 *
 * No polegar, não no topo: o vendedor segura o celular com uma mão só,
 * frequentemente em pé na porta de um cliente. O que ele usa o dia inteiro
 * precisa estar onde o polegar alcança sem trocar a mão de posição.
 */

type Item = { href: string; rotulo: string; icone: React.ReactNode }

function Icone({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function BarraInferior({ ehGestor }: { ehGestor: boolean }) {
  const caminho = usePathname()

  const itens: Item[] = [
    {
      href: '/agenda',
      rotulo: 'Hoje',
      icone: (
        <Icone>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
          <path d="m9 15 2 2 4-4" />
        </Icone>
      ),
    },
    {
      href: '/visita/nova',
      rotulo: 'Nova',
      icone: (
        <Icone>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </Icone>
      ),
    },
  ]

  if (ehGestor) {
    itens.push({
      href: '/painel',
      rotulo: 'Painel',
      icone: (
        <Icone>
          <path d="M3 20h18" />
          <rect x="5" y="12" width="3.5" height="8" rx="1" />
          <rect x="10.25" y="7" width="3.5" height="13" rx="1" />
          <rect x="15.5" y="15" width="3.5" height="5" rx="1" />
        </Icone>
      ),
    })
    itens.push({
      href: '/admin',
      rotulo: 'Equipe',
      icone: (
        <Icone>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
          <path d="M16 5.5a3.5 3.5 0 0 1 0 6.9M17.5 20a6.5 6.5 0 0 0-2-4.7" />
        </Icone>
      ),
    })
  }

  return (
    <nav
      aria-label="Navegação principal"
      className="sticky bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl">
        {itens.map((item) => {
          // `startsWith` para a aba continuar acesa nas telas filhas —
          // abrir uma visita não pode apagar "Hoje".
          const ativo =
            item.href === '/agenda'
              ? caminho === '/agenda' || caminho.startsWith('/visita/') && caminho !== '/visita/nova'
              : caminho === item.href

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold tracking-wide transition-colors ${
                  ativo ? 'text-fazer' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {item.icone}
                {item.rotulo}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
