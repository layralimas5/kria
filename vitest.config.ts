import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // As edge functions importam pelo especificador do Deno; nos testes vale o pacote do node_modules.
    // `@` igual ao vite.config.ts, para testar módulo do app que importa pelo alias.
    alias: { 'npm:zod@3': 'zod', '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    include: ['supabase/functions/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
