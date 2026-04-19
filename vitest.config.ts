import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/globalSetup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallel: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
