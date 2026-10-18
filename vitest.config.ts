import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // As edge functions importam pelo especificador do Deno; nos testes vale o pacote do node_modules.
    alias: { 'npm:zod@3': 'zod' },
  },
  test: {
    include: ['supabase/functions/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
