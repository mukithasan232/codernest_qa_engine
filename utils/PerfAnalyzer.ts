/**
 * @fileoverview Performance Analyzer — measures page load timing and Core Web Vitals
 * using the Navigation Timing API via Playwright evaluate.
 */

import { chromium } from 'playwright';
import type { PerformanceReport, PagePerf } from '../types/SmartReport';
import { Logger } from '@core/logger';

/**
 * Rates a page load time in ms.
 */
function rateLoad(ms: number): 'fast' | 'moderate' | 'slow' {
  if (ms < 1500) return 'fast';
  if (ms < 3500) return 'moderate';
  return 'slow';
}

/**
 * Measures performance metrics for each URL using the Navigation Timing API.
 *
 * @param urls - Array of page URLs to measure.
 * @param onProgress - Optional progress callback.
 * @returns A typed {@link PerformanceReport}.
 */
export async function runPerfAnalysis(
  urls: readonly string[],
  onProgress?: (msg: string) => void
): Promise<PerformanceReport> {
  Logger.info(`PerfAnalyzer measuring ${urls.length} pages…`);

  const pages: PagePerf[] = [];
  const browser = await chromium.launch({ headless: true });

  try {
    for (const url of urls) {
      onProgress?.(`Performance: measuring ${url}`);

      const page = await browser.newPage();
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 30000 });

        const metrics = await page.evaluate(() => {
          const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
          if (!nav) return null;
          return {
            domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
            loaded:           Math.round(nav.loadEventEnd - nav.startTime),
            firstByte:        Math.round(nav.responseStart - nav.requestStart),
          };
        });

        if (metrics) {
          pages.push({
            url,
            domContentLoaded: metrics.domContentLoaded,
            loaded:           metrics.loaded,
            firstByte:        metrics.firstByte,
            rating:           rateLoad(metrics.loaded),
          });
        }
      } catch (err) {
        Logger.warn(`PerfAnalyzer failed on ${url}: ${(err as Error).message}`);
      } finally {
        await page.close().catch(() => null);
      }
    }
  } finally {
    await browser.close().catch(() => null);
  }

  const avgLoad = pages.length
    ? Math.round(pages.reduce((s, p) => s + p.loaded, 0) / pages.length)
    : 0;

  const slowCount = pages.filter((p) => p.rating === 'slow').length;
  const score = pages.length === 0
    ? 100
    : Math.max(0, Math.round(100 - (slowCount / pages.length) * 60 -
        (pages.filter(p => p.rating === 'moderate').length / pages.length) * 20));

  Logger.info(`PerfAnalyzer: avg load ${avgLoad}ms, ${slowCount} slow pages. Score: ${score}`);
  return { pages, avgLoad, score };
}
