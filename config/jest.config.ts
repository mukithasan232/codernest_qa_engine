import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '../',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/core/$1',
  },
  collectCoverage: true,
  coverageDirectory: '<rootDir>/reports/coverage',
  reporters: [
    'default',
    ['jest-html-reporter', {
      pageTitle: 'Test Report',
      outputPath: 'reports/test-report.html'
    }]
  ]
};

export default config;
