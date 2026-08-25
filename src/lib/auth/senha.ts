import bcrypt from 'bcryptjs'
import { normalizarTelefone } from '@/lib/zaple/contatos'
import { buscarPorTelefone } from './repositorio'
import type { ProvedorLogin } from './tipos'

const CUSTO = 12

/** Hash de referência para comparar quando o usuário não existe. */
const HASH_FANTASMA = bcrypt.hashSync('nenhuma-senha-corresponde-a-isto', CUSTO)

export function gerarHash(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO)
}

export const provedorSenha: ProvedorLogin = {
  async iniciarLogin() {
    return { precisaSegredo: true }
  },

  async confirmarLogin(identificador, segredo) {
    const u = await buscarPorTelefone(normalizarTelefone(identificador))
    // Compara mesmo sem usuário, para que o tempo de resposta não revele
    // quais telefones existem na base.
    const confere = await bcrypt.compare(segredo, u?.senhaHash ?? HASH_FANTASMA)
    if (!u || !confere || !u.ativo) return null
    return u
  },
}
