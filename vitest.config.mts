import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    /**
     * Os testes de repositório sobem um Postgres em memória e aplicam as
     * migrações reais a cada caso — mais lento que um mock, e de propósito:
     * é o que pega `where` errado e coluna com nome trocado.
     *
     * O padrão de 5s do Vitest não cobre isso quando a máquina está ocupada,
     * e o teste falha por relógio em vez de por defeito. Um teste que fica
     * vermelho sem motivo ensina a ignorar vermelho.
     */
    testTimeout: 20_000,
    hookTimeout: 20_000,
    /**
     * Um arquivo de teste por vez.
     *
     * Em paralelo, cada arquivo sobe seu próprio Postgres em memória e roda
     * bcrypt ao mesmo tempo que os outros. A máquina satura, os casos
     * estouram o relógio, e a falha muda de lugar a cada rodada — o pior tipo
     * de teste, porque ensina a suspeitar do relógio em vez do código.
     *
     * A suíte fica mais lenta e passa a dizer a verdade. É a troca certa.
     */
    fileParallelism: false,
  },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
})
