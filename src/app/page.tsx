import { redirect } from 'next/navigation'
import { usuarioAtual } from '@/lib/auth/atual'

export const dynamic = 'force-dynamic'

export default async function Raiz() {
  // Decidir aqui, e não mandar todo mundo para /agenda, evita que quem não
  // está logado passe pelo layout autenticado só para ser expulso de volta.
  redirect((await usuarioAtual()) ? '/agenda' : '/login')
}
