import type { Usuario } from '@/lib/db/schema'

/**
 * A fronteira que permite trocar senha por OTP no WhatsApp sem tocar em tela
 * nenhuma. Hoje `iniciarLogin` é quase vazio; com OTP ele passa a disparar o
 * código.
 *
 * O OTP está bloqueado hoje porque o token de painel (pn_) não tem permissão
 * de envio: /core/v1/send/* responde ERROR_UNAUTHORIZED.
 */
export interface ProvedorLogin {
  iniciarLogin(identificador: string): Promise<{ precisaSegredo: true }>
  confirmarLogin(identificador: string, segredo: string): Promise<Usuario | null>
}
