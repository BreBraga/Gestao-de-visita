import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const NOME = 'sessao'
const DIAS = 30

function chave(): Uint8Array {
  const segredo = process.env.SESSION_SECRET
  if (!segredo) throw new Error('SESSION_SECRET não configurado')
  return new TextEncoder().encode(segredo)
}

export async function criarSessao(usuarioId: string): Promise<void> {
  const token = await new SignJWT({ sub: usuarioId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DIAS}d`)
    .sign(chave())

  const jar = await cookies()
  jar.set(NOME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DIAS * 24 * 60 * 60,
  })
}

export async function lerSessao(): Promise<string | null> {
  const token = (await cookies()).get(NOME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, chave())
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies()
  jar.delete(NOME)
}
