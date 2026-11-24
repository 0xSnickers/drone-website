import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: ['--no-experimental-webstorage'],
      },
    },
    include: ['tests/**/*.test.ts'],
  },
});
