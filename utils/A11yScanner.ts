/**
 * @fileoverview Accessibility Scanner — runs axe-core on every discovered page
 * via Playwright and returns WCAG 2.1 violation reports.
 */

import { chromium } from 'playwright';
import AxeBuilder   from '@axe-core/playwright';
import type { AccessibilityReport, A11yViolation } from '../types/SmartReport';
import { Logger } from '../core/logger';

/**
 * Scans all given URLs for WCAG 2.1 accessibility violations using axe-core.
 *
 * @param urls - Array of page URLs to scan.
 * @param onProgress - Optional progress callback.
 * @returns A typed {@link AccessibilityReport}.
 */
export async function runA11yScan(
  urls: readonly string[],
  onProgress?: (msg: string) => void
): Promise<AccessibilityReport> {
  Logger.info(`A11yScanner scanning ${urls.length} pages…`);

  const violationMap = new Map<string, A11yViolation>();
  const browser = await chromium.launch({ headless: true });

  try {
    for (const url of urls) {
      onProgress?.(`Accessibility: scanning ${url}`);

      const page = await browser.newPage();
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        for (const v of results.violations) {
          const key = v.id;
          if (violationMap.has(key)) {
            const existing = violationMap.get(key)!;
            violationMap.set(key, { ...existing, count: existing.count + v.nodes.length });
          } else {
            violationMap.set(key, {
              id:          v.id,
              description: v.description,
              impact:      v.impact ?? 'minor',
              page:        url,
              count:       v.nodes.length,
            });
          }
        }
      } catch (err) {
        Logger.warn(`A11yScanner failed on ${url}: ${(err as Error).message}`);
      } finally {
        await page.close().catch(() => null);
      }
    }
  } finally {
    await browser.close().catch(() => null);
  }

  const violations    = [...violationMap.values()];
  const criticalCount = violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  ).length;

  const score = violations.length === 0
    ? 100
    : Math.max(0, Math.round(100 - criticalCount * 20 - (violations.length - criticalCount) * 5));

  Logger.info(`A11yScanner: ${violations.length} violations, ${criticalCount} critical. Score: ${score}`);
  return { violations, totalViolations: violations.length, criticalCount, score };
}
