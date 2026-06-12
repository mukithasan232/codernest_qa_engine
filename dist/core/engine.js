"use strict";
/**
 * @fileoverview Core QA Engine — test runner.
 * Programmatically triggers Jest test suites.
 * Firebase reporting removed; results are logged to console and CI artifacts.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
const jest_1 = require("jest");
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const logger_1 = require("@core/logger");
const CoreUtils_1 = require("@core/CoreUtils");
// ─── Path Constants ────────────────────────────────────────────────────────
const PROJECT_ROOT = path.resolve(__dirname, '../');
const JEST_CONFIG = path.resolve(__dirname, '../config/jest.config.ts');
// ─── Result Mapper ─────────────────────────────────────────────────────────
/**
 * Maps Jest's AggregatedResult into the engine's typed {@link TestSuiteResult}.
 */
function mapJestResult(jestResult, runId, durationMs) {
    const testCases = [];
    for (const suite of jestResult.testResults) {
        for (const tc of suite.testResults) {
            const status = tc.status === 'passed' ? 'passed' :
                tc.status === 'failed' ? 'failed' :
                    tc.status === 'pending' ? 'pending' : 'skipped';
            testCases.push({
                testName: tc.fullName,
                status,
                durationMs: tc.duration ?? 0,
                errorMessage: tc.failureMessages.join('\n') || undefined,
            });
        }
    }
    return {
        runId,
        suiteName: 'CoderNest QA Core — Full Suite',
        status: jestResult.success ? 'passed' : 'failed',
        totalTests: jestResult.numTotalTests,
        passedTests: jestResult.numPassedTests,
        failedTests: jestResult.numFailedTests,
        skippedTests: jestResult.numPendingTests + jestResult.numTodoTests,
        totalDurationMs: durationMs,
        testCases,
        environment: CoreUtils_1.CoreUtils.getEnvironmentLabel(),
    };
}
// ─── Engine Entry Point ────────────────────────────────────────────────────
/**
 * Runs the full Jest test suite programmatically.
 * Results are logged to console and written to `reports/` by jest-html-reporter.
 *
 * @returns The typed {@link TestSuiteResult} of the completed run.
 */
async function runTests() {
    const runId = (0, crypto_1.randomUUID)();
    const start = Date.now();
    logger_1.Logger.info(`══════════════════════════════════════════════════`);
    logger_1.Logger.info(` CoderNest QA Core — Test Run Starting`);
    logger_1.Logger.info(` Run ID : ${runId}`);
    logger_1.Logger.info(` Env    : ${CoreUtils_1.CoreUtils.getEnvironmentLabel()}`);
    logger_1.Logger.info(`══════════════════════════════════════════════════`);
    const { results } = await (0, jest_1.runCLI)({ config: JEST_CONFIG, _: [], $0: '' }, [PROJECT_ROOT]);
    const durationMs = Date.now() - start;
    const suiteResult = mapJestResult(results, runId, durationMs);
    if (suiteResult.status === 'passed') {
        logger_1.Logger.success(`${suiteResult.totalTests} tests passed in ${durationMs}ms.`);
    }
    else {
        logger_1.Logger.error(`${suiteResult.failedTests}/${suiteResult.totalTests} tests failed after ${durationMs}ms.`);
    }
    return suiteResult;
}
// ─── CLI Entrypoint ────────────────────────────────────────────────────────
if (require.main === module) {
    runTests()
        .then((r) => process.exit(r.status === 'passed' ? 0 : 1))
        .catch((err) => {
        logger_1.Logger.error('Critical engine failure.', err);
        process.exit(1);
    });
}
