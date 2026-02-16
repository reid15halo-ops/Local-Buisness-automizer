import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Global test environment setup
    globals: true,
    environment: 'jsdom',

    // Test files matching pattern
    include: ['tests/**/*.test.js'],

    // Coverage settings
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/'
      ]
    },

    // Timeout settings
    testTimeout: 10000,
    hookTimeout: 10000,

    // Output settings
    reporters: ['verbose']
  }
});
