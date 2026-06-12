/**
 * @fileoverview Firebase Admin SDK integration for the CoderNest QA Core engine.
 * Handles Firestore initialization and all test-reporting write operations.
 * Uses explicit interfaces — no `any` or `object` types.
 */

import * as admin from 'firebase-admin';
import { Logger } from '@core/logger';
import type { TestSuiteResult } from '../types/TestResult';

// ─── Firebase Initialization ───────────────────────────────────────────────
// SDK is initialized once via GOOGLE_APPLICATION_CREDENTIALS env var.
// In CI/CD, inject this var as a secret pointing to your service account JSON.
if (!admin.apps.length) {
  admin.initializeApp();
  Logger.info('Firebase Admin SDK initialized.');
}

const db: admin.firestore.Firestore = admin.firestore();

/** Firestore collection name for test run reports. */
const COLLECTION_NAME = 'test_reports' as const;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Logs a complete test suite result to the Firestore `test_reports` collection.
 * Each document is uniquely keyed by the `runId` in the payload, making
 * idempotent re-runs safe (overwrites the same document on retry).
 *
 * @param result - A fully-typed {@link TestSuiteResult} object.
 * @returns The Firestore document reference that was written to.
 * @throws Will rethrow if Firestore write fails, allowing the engine to handle it.
 *
 * @example
 * ```ts
 * await logTestResult({
 *   runId: 'ci-build-42',
 *   suiteName: 'User API',
 *   status: 'passed',
 *   ...
 * });
 * ```
 */
export async function logTestResult(
  result: TestSuiteResult
): Promise<admin.firestore.DocumentReference> {
  Logger.info(`Logging results for suite: "${result.suiteName}" (runId: ${result.runId})`);

  try {
    // Use runId as the document ID to ensure idempotent writes
    const docRef = db.collection(COLLECTION_NAME).doc(result.runId);

    await docRef.set({
      ...result,
      // Override with a server-side timestamp for accuracy
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    Logger.success(`Test result for "${result.suiteName}" logged to Firestore (doc: ${result.runId}).`);
    return docRef;
  } catch (error) {
    Logger.error(`Failed to log test result for "${result.suiteName}" to Firestore.`, error);
    throw error;
  }
}

/**
 * Retrieves all test reports from Firestore, ordered by latest first.
 * Intended for use in reporting dashboards or health-check scripts.
 *
 * @param limit - Maximum number of reports to retrieve. Defaults to 20.
 * @returns An array of {@link TestSuiteResult} documents.
 */
export async function getTestReports(limit = 20): Promise<TestSuiteResult[]> {
  Logger.info(`Fetching last ${limit} test reports from Firestore.`);

  try {
    const snapshot = await db
      .collection(COLLECTION_NAME)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as TestSuiteResult);
  } catch (error) {
    Logger.error('Failed to retrieve test reports from Firestore.', error);
    throw error;
  }
}
