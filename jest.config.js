module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo-crypto$': '<rootDir>/__mocks__/expo-crypto.ts',
    '^expo-localization$': '<rootDir>/__mocks__/expo-localization.ts',
  },
  transform: {
    '^.+\\.(t|j)sx?$': 'babel-jest',
  },
};
