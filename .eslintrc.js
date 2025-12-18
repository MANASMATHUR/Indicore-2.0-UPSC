module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    extends: [
        'eslint:recommended',
        'next/core-web-vitals',
    ],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
            jsx: true,
        },
    },
    rules: {
        // Enforce no console statements except warn and error
        'no-console': ['warn', { allow: ['warn', 'error'] }],

        // Prefer const over let
        'prefer-const': 'error',

        // Require === and !== instead of == and !=
        'eqeqeq': ['error', 'always'],

        // Disallow unused variables
        'no-unused-vars': ['warn', {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_'
        }],

        // Enforce consistent return statements
        'consistent-return': 'warn',

        // Require default case in switch statements
        'default-case': 'warn',

        // Disallow use of alert, confirm, and prompt
        'no-alert': 'warn',

        // Disallow eval()
        'no-eval': 'error',

        // Require let or const instead of var
        'no-var': 'error',

        // Suggest using arrow functions for callbacks
        'prefer-arrow-callback': 'warn',

        // Suggest using template literals instead of string concatenation
        'prefer-template': 'warn',

        // React specific rules
        'react/prop-types': 'off', // We're not using PropTypes
        'react/react-in-jsx-scope': 'off', // Not needed in Next.js
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
    },
    settings: {
        react: {
            version: 'detect',
        },
    },
};
