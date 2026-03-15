import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/unit/setup.js'],
    include: ['tests/unit/**/*.test.js'],
    coverage: {
      include: ['js/**/*.js'],
      exclude: ['js/steps/**', 'js/app.js', 'js/wizard.js'],
    },
  },
});
