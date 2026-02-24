import js from '@eslint/js';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'tests/**',
      '*.min.js',
      '.git/**',
      '.github/**'
    ]
  },
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly'
      }
    },
    rules: {
      'semi': ['error', 'always'],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'all']
    }
  }
];
