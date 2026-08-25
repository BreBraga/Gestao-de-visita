import { listarEtapas } from '@/lib/zaple/painel'

const etapas = await listarEtapas()
console.table(etapas)

if (etapas.length !== 4) {
  console.error('ESPERADO 4 etapas, veio', etapas.length, '— ajuste painel.ts conforme a nota do plano')
  process.exit(1)
}
