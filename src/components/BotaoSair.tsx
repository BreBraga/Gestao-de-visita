'use client'
import { useRouter } from 'next/navigation'

export function BotaoSair() {
  const router = useRouter()

  async function sair() {
    await fetch('/api/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  return (
    <button onClick={sair} className="text-slate-500 underline">
      Sair
    </button>
  )
}
