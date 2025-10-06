/* eslint-env node */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^jira\\.js$': '<rootDir>/src/__mocks__/jira.js.ts',
  },
}; 