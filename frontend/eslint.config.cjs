const js = require('@eslint/js');
const globals = require('globals');
const react = require('eslint-plugin-react');
const hooks = require('eslint-plugin-react-hooks');

module.exports = [
  { ignores: ['node_modules/**', 'build/**', 'dist/**', 'coverage/**', 'public/**', 'docs/**', '**/*.bak', '**/*.before-*'] },
  {
    files: ['**/*.{js,jsx,cjs}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, process: 'readonly' },
    },
    plugins: { react, 'react-hooks': hooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...js.configs.recommended.rules,
      ...hooks.configs.recommended.rules,
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/jsx-no-undef': 'error',
      'react/jsx-key': 'warn',
      'react/no-direct-mutation-state': 'error',
      'react/no-danger-with-children': 'error',
      // Existing unused bindings are visible without making cosmetic cleanup
      // a prerequisite for focused changes. Correctness rules stay errors.
      'no-unused-vars': ['warn', { args: 'after-used', caughtErrors: 'none' }],
    },
  },
  { files: ['*.config.{js,cjs}', 'scripts/**/*.{js,cjs}'], languageOptions: { sourceType: 'commonjs', globals: globals.node } },
  { files: ['src/**/*.test.{js,jsx}', 'src/setupTests.js', 'src/test-support/**/*.{js,jsx}'], languageOptions: { globals: { ...globals.jest, ...globals.node } } },
];
