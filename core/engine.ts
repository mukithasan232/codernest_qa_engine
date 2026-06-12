/**
 * @fileoverview Core QA Engine — test runner.
 * Programmatically triggers Jest test suites.
 * Firebase reporting removed; results are logged to console and CI artifacts.
 */

import { runCLI } from 'jest';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Logger } from './logger';
import { CoreUtils } from './CoreUtils';
import type { TestSuiteResult, TestCaseResult, TestStatus } from '../types/TestResult';

// ─── Path Constants ────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '../');
const JEST_CONFIG  = path.resolve(__dirname, '../config/jest.config.ts');

// ─── Result Mapper ─────────────────────────────────────────────────────────

/**
 * Maps Jest's AggregatedResult into the engine's typed {@link TestSuiteResult}.
 */
function mapJestResult(
  jestResult: Awaited<ReturnType<typeof runCLI>>['results'],
  runId: string,
  durationMs: number
): TestSuiteResult {
  const testCases: TestCaseResult[] = [];

  for (const suite of jestResult.testResults) {
    for (const tc of suite.testResults) {
      const status: TestStatus =
        tc.status === 'passed'  ? 'passed'  :
        tc.status === 'failed'  ? 'failed'  :
        tc.status === 'pending' ? 'pending' : 'skipped';

      testCases.push({
        testName:     tc.fullName,
        status,
        durationMs:   tc.duration ?? 0,
        errorMessage: tc.failureMessages.join('\n') || undefined,
      });
    }
  }

  return {
    runId,
    suiteName:       'CoderNest QA Core — Full Suite',
    status:          jestResult.success ? 'passed' : 'failed',
    totalTests:      jestResult.numTotalTests,
    passedTests:     jestResult.numPassedTests,
    failedTests:     jestResult.numFailedTests,
    skippedTests:    jestResult.numPendingTests + jestResult.numTodoTests,
    totalDurationMs: durationMs,
    testCases,
    environment:     CoreUtils.getEnvironmentLabel(),
  };
}

// ─── Engine Entry Point ────────────────────────────────────────────────────

/**
 * Runs the full Jest test suite programmatically.
 * Results are logged to console and written to `reports/` by jest-html-reporter.
 *
 * @returns The typed {@link TestSuiteResult} of the completed run.
 */
export async function runTests(): Promise<TestSuiteResult> {
  const runId    = randomUUID();
  const start    = Date.now();

  Logger.info(`══════════════════════════════════════════════════`);
  Logger.info(` CoderNest QA Core — Test Run Starting`);
  Logger.info(` Run ID : ${runId}`);
  Logger.info(` Env    : ${CoreUtils.getEnvironmentLabel()}`);
  Logger.info(`══════════════════════════════════════════════════`);

  const { results } = await runCLI(
    { config: JEST_CONFIG, _: [], $0: '' } as Parameters<typeof runCLI>[0],
    [PROJECT_ROOT]
  );

  const durationMs  = Date.now() - start;
  const suiteResult = mapJestResult(results, runId, durationMs);

  if (suiteResult.status === 'passed') {
    Logger.success(`${suiteResult.totalTests} tests passed in ${durationMs}ms.`);
  } else {
    Logger.error(`${suiteResult.failedTests}/${suiteResult.totalTests} tests failed after ${durationMs}ms.`);
  }

  return suiteResult;
}

// ─── CLI Entrypoint ────────────────────────────────────────────────────────

if (require.main === module) {
  runTests()
    .then((r) => process.exit(r.status === 'passed' ? 0 : 1))
    .catch((err: unknown) => {
      Logger.error('Critical engine failure.', err);
      process.exit(1);
    });
}
