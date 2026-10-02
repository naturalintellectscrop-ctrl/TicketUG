import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Root suite covers lib/ unit tests (rules, tickets, payments, server) via `pnpm test`.
// Pair 6: apps/api is removed — the Supabase-native server layer lives in lib/. The
// DB integration suite activates with TEST_DATABASE_URL (throwaway/staging DB only).
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
    ],
  },
})
