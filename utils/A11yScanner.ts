/**
 * @fileoverview Accessibility Scanner — mocked for Vercel Serverless environment.
 */

import type { AccessibilityReport, A11yViolation } from '../types/SmartReport';
import { Logger } from '../core/logger';

export async function runA11yScan(
  urls: readonly string[],
  onProgress?: (msg: string) => void
): Promise<AccessibilityReport> {
  Logger.info(`A11yScanner bypassing scan in serverless environment`);

  const violations: A11yViolation[] = [];
  
  for (const url of urls) {
    onProgress?.(`Accessibility disabled: skipping ${url}`);
  }

  const score = 100;
  Logger.info(`A11yScanner (Mocked): 0 violations. Score: ${score}`);
  
  return { violations, totalViolations: 0, criticalCount: 0, score };
}
