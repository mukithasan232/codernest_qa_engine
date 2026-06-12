/**
 * @fileoverview Central QA Engine for the CoderNest QA Core project.
 * Programmatically triggers Jest test suites and forwards aggregated results
 * to Firebase Firestore via `firebaseService.ts`.
 */

import { runCLI } from 'jest';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Logger } from '@core/logger';
import { logTestResult } from '@core/firebaseService';
import { CoreUtils } from '@core/CoreUtils';
import type { TestSuiteResult, TestCaseResult, TestStatus } from '../types/TestResult';

// ─── Path Constants ────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '../');
const JEST_CONFIG   = path.resolve(__dirname, '../config/jest.config.ts');

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Maps Jest's AggregatedResult into the engine's typed {@link TestSuiteResult}.
 *
 * @param jestResult - The raw result object returned by Jest's `runCLI`.
 * @param runId - The UUID generated for this specific run.
 * @returns A fully-typed {@link TestSuiteResult}.
 */
function mapJestResultToSuiteResult(
  // Using a specific type from Jest's API
  jestResult: Awaited<ReturnType<typeof runCLI>>['results'],
  runId: string
): TestSuiteResult {
  const testCases: TestCaseResult[] = [];

  for (const suite of jestResult.testResults) {
    for (const testCase of suite.testResults) {
      const status: TestStatus =
        testCase.status === 'passed'  ? 'passed'  :
        testCase.status === 'failed'  ? 'failed'  :
        testCase.status === 'pending' ? 'pending' : 'skipped';

      testCases.push({
        testName:    testCase.fullName,
        status,
        durationMs:  testCase.duration ?? 0,
        errorMessage: testCase.failureMessages.join('\n') || undefined,
      });
    }
  }

  const overallStatus: TestStatus = jestResult.success ? 'passed' : 'failed';

  return {
    runId,
    suiteName:       'CoderNest QA Core — Full Suite',
    status:          overallStatus,
    totalTests:      jestResult.numTotalTests,
    passedTests:     jestResult.numPassedTests,
    failedTests:     jestResult.numFailedTests,
    skippedTests:    jestResult.numPendingTests + jestResult.numTodoTests,
    totalDurationMs: Date.now(), // replaced below with accurate delta
    testCases,
    environment:     CoreUtils.getEnvironmentLabel(),
  };
}

// ─── Engine Entry Point ────────────────────────────────────────────────────

/**
 * Runs the full Jest test suite programmatically and logs the aggregated
 * results to Firestore. This is the single entry point for CI/CD pipelines.
 *
 * @returns The typed {@link TestSuiteResult} of the completed run.
 */
export async function runTests(): Promise<TestSuiteResult> {
  const runId = randomUUID();
  const startTime = Date.now();

  Logger.info(`══════════════════════════════════════════════════`);
  Logger.info(` CoderNest QA Core — Test Run Starting`);
  Logger.info(` Run ID   : ${runId}`);
  Logger.info(` Config   : ${JEST_CONFIG}`);
  Logger.info(` Env      : ${CoreUtils.getEnvironmentLabel()}`);
  Logger.info(`══════════════════════════════════════════════════`);

  const { results } = await runCLI(
    { config: JEST_CONFIG, _: [], $0: '' } as Parameters<typeof runCLI>[0],
    [PROJECT_ROOT]
  );

  const durationMs = Date.now() - startTime;
  const suiteResult = mapJestResultToSuiteResult(results, runId);

  // Patch in the accurate total duration
  const finalResult: TestSuiteResult = { ...suiteResult, totalDurationMs: durationMs };

  if (finalResult.status === 'passed') {
    Logger.success(`All ${finalResult.totalTests} tests passed in ${durationMs}ms.`);
  } else {
    Logger.error(
      `${finalResult.failedTests} of ${finalResult.totalTests} tests failed after ${durationMs}ms.`
    );
  }

  // Log to Firestore (non-blocking; failure is logged but doesn't fail the engine)
  try {
    await logTestResult(finalResult);
  } catch {
    Logger.warn('Firestore logging failed. Test results are still valid.');
  }

  return finalResult;
}

// ─── CLI Entrypoint ────────────────────────────────────────────────────────

if (require.main === module) {
  runTests()
    .then((result) => {
      process.exit(result.status === 'passed' ? 0 : 1);
    })
    .catch((error: unknown) => {
      Logger.error('Critical engine failure.', error);
      process.exit(1);
    });
}
