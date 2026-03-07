module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.ts', '**/*.spec.ts', '**/*.test.ts'],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    collectCoverageFrom: [
        'src/**/*.{ts,js}',
        '!src/**/*.spec.ts',
        '!src/**/*.test.ts',
        '!src/main.ts',
        '!src/**/*.module.ts',
        '!src/**/*.dto.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
    },
    testTimeout: 10000,
    globals: {
        'ts-jest': {
            tsconfig: {
                esModuleInterop: true,
            },
        },
    },
};
