import { nivalis } from '@nivalis/eslint-config';

export default nivalis(
  {
    tailwindcss: false,
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      'no-empty-function': 'off',
    },
  },
  {
    files: ['src/cli/**/*.ts'],
    rules: {
      'node/hashbang': 'off',
      'no-console': 'off',
    },
  },
);
