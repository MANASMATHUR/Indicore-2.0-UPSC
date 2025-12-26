export default {
    testEnvironment: 'node',
    transform: {},
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^@/lib/(.*)$': '<rootDir>/lib/$1',
        '^@/models/(.*)$': '<rootDir>/models/$1'
    },
    testMatch: [
        '**/__tests__/**/*.[jt]s?(x)'
    ]
};
