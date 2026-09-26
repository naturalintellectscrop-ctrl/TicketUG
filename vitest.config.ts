import { defineConfig } from 'vitest/config'

// Root suite covers lib/ unit tests plus apps/api/src rule modules (run via `pnpm test`).
// The compiled `apps/api/dist` output and the API's own node_modules must never be
// collected — use `pnpm api:test` for the API workspace suite.
export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      'apps/api/dist/**',
    ],
  },
})
