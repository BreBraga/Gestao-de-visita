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
  },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
})
