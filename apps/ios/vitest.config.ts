import { defineConfig } from 'vitest/config';

// Unit tests of the shell: pure TypeScript only, no React Native import, plain Node.
// The root vitest config excludes apps/** (the web suite installs no Expo package).
export default defineConfig({
  test: {
    root: __dirname,
    include: ['src/**/*.test.ts', 'plugins/**/*.test.ts'],
    environment: 'node',
  },
});
