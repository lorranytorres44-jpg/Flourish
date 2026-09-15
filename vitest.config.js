import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Os testes de regras precisam do emulador do Firestore rodando (npm run test:rules);
    // os unitários rodam sozinhos (npm test).
    include: ['tests/**/*.test.js'],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
