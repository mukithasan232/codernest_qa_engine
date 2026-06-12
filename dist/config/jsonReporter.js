"use strict";
/**
 * @fileoverview Custom Jest reporter that writes a structured JSON results file
 * to `reports/results.json` after every test run.
 * This file is consumed by the Express API and the QA Dashboard.
 *
 * Must use `module.exports` (CommonJS) so Jest can load it at runtime.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
class JsonReporter {
    onRunComplete(_contexts, results) {
        const outputPath = path.resolve(process.cwd(), 'reports', 'results.json');
        const suites = results.testResults.map((suite) => ({
            file: path.relative(process.cwd(), suite.testFilePath),
            passed: suite.numPassingTests,
            failed: suite.numFailingTests,
            pending: suite.numPendingTests,
            tests: suite.testResults.map((t) => ({
                name: t.fullName,
                status: t.status,
                durationMs: t.duration ?? 0,
                errorMessage: t.failureMessages.join('\n').slice(0, 500) || null,
            })),
        }));
        const output = {
            timestamp: new Date().toISOString(),
            success: results.success,
            total: results.numTotalTests,
            passed: results.numPassedTests,
            failed: results.numFailedTests,
            skipped: results.numPendingTests + results.numTodoTests,
            suites,
        };
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`\n[JsonReporter] Results saved → ${outputPath}`);
    }
}
module.exports = JsonReporter;
