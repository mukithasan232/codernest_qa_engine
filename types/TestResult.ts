/**
 * @fileoverview Shared type definitions for the CoderNest QA Core engine.
 * All test result payloads must conform to these interfaces.
 */

/** The possible statuses of a test run or individual test case. */
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending';

/**
 * Represents the result of a single test case.
 */
export interface TestCaseResult {
  /** The full name/description of the test (e.g., "GET /users returns 200"). */
  readonly testName: string;
  /** The pass/fail/skip status of this test. */
  readonly status: TestStatus;
  /** Execution duration in milliseconds. */
  readonly durationMs: number;
  /** Error message if the test failed, undefined otherwise. */
  readonly errorMessage?: string;
}

/**
 * Represents the aggregated result of a complete test suite run.
 * This is the contract for the Firestore `test_reports` collection documents.
 */
export interface TestSuiteResult {
  /** Unique identifier for this test run (e.g., a UUID or CI build number). */
  readonly runId: string;
  /** The name of the test suite (e.g., "User API - Integration Tests"). */
  readonly suiteName: string;
  /** The overall status of the suite. "passed" only if all tests passed. */
  readonly status: TestStatus;
  /** Total number of tests executed. */
  readonly totalTests: number;
  /** Number of tests that passed. */
  readonly passedTests: number;
  /** Number of tests that failed. */
  readonly failedTests: number;
  /** Number of tests that were skipped or pending. */
  readonly skippedTests: number;
  /** Total execution duration in milliseconds. */
  readonly totalDurationMs: number;
  /** Individual test case results within this suite. */
  readonly testCases: TestCaseResult[];
  /** The git branch or environment tag this run was triggered from. */
  readonly environment: string;
}
