import type { Config } from 'jest';

/**
 * @fileoverview Jest configuration for the CoderNest QA Core engine.
 * Supports TypeScript via ts-jest, coverage reporting, and HTML report generation.
 * Path aliases mirror tsconfig.json to ensure consistent module resolution.
 */
const config: Config = {
  // Use ts-jest to transpile TypeScript on-the-fly — no separate build step needed.
  preset: 'ts-jest',
  testEnvironment: 'node',

  // rootDir points to the project root so all paths resolve correctly.
  rootDir: '../',

  // Discovers all test files under tests/ matching the *.test.ts pattern.
  testMatch: ['<rootDir>/tests/**/*.test.ts'],

  // Path aliases must mirror tsconfig.json `paths` for consistent resolution.
  moduleNameMapper: {
    '^@core/(.*)$':  '<rootDir>/core/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
  },

  // Run a global setup file before any test suite is loaded.
  globalSetup: '<rootDir>/config/globalSetup.ts',

  // Coverage: collect from all source files, not just the ones imported by tests.
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/core/**/*.ts',
    '<rootDir>/utils/**/*.ts',
    '!<rootDir>/**/*.d.ts',
  ],
  coverageDirectory: '<rootDir>/reports/coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Reporters: 'default' for console + jest-html-reporter for client-facing HTML.
  reporters: [
    'default',
    '<rootDir>/config/jsonReporter.ts',
    [
      'jest-html-reporter',
      {
        pageTitle:          'CoderNest QA Core — Test Report',
        outputPath:         'reports/test-report.html',
        includeFailureMsg:  true,
        includeConsoleLog:  true,
        sort:               'status',
        dateFormat:         'yyyy-mm-dd HH:MM:ss',
      },
    ],
  ],

  // ts-jest config: use a separate tsconfig for tests if needed.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },

  // Fail fast: stop after 3 consecutive suite failures to keep CI logs clean.
  bail: 3,

  // Verbose mode for clear per-test console output during local development.
  verbose: true,
};

export default config;
