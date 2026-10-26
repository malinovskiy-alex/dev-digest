import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Types-only in src/ (erased before runtime); the alias exists so a test
      // that names a shared type resolves the same file tsconfig `paths` does.
      '@devdigest/shared': fileURLToPath(new URL('../server/src/vendor/shared', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
