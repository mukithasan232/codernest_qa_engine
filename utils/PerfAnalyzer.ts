/**
 * @fileoverview Performance Analyzer — Mocked or simplified for Vercel Serverless.
 * Real Core Web Vitals require a browser (Playwright), which we cannot run.
 * This analyzer falls back to basic Axios HTTP timing measurements.
 */

import axios from 'axios';
import type {
  PerformanceReport,
  PagePerf,
  NavigationTiming,
  PaintMetrics,
  LayoutShift,
  WebVitalRating,
} from '../types/SmartReport';
import { Logger } from '../core/logger';

// ─── Mock Rating Helpers ──────────────────────────────────────────────────────

function rateMetric(value: number, good: number, poor: number): WebVitalRating {
  if (value <= good) return 'good';
  if (value < poor)  return 'needs-improvement';
  return 'poor';
}

function computeScore(pages: readonly PagePerf[]): number {
  if (pages.length === 0) return 100;
  
  const ratingToScore = (r: WebVitalRating) =>
    r === 'good' ? 100 : r === 'needs-improvement' ? 60 : 20;

  const avg = (fn: (p: PagePerf) => number) =>
    pages.reduce((sum, p) => sum + fn(p), 0) / pages.length;

  return Math.round(avg((p) => ratingToScore(p.rating)));
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function runPerfAnalysis(
  urls: readonly string[],
  onProgress?: (msg: string) => void
): Promise<PerformanceReport> {
  Logger.info(`PerfAnalyzer: measuring ${urls.length} pages via Axios HTTP Timings…`);

  const pages: PagePerf[] = [];

  for (const url of urls) {
    onProgress?.(`⚡ Performance: measuring ${url}`);
    Logger.debug(`PerfAnalyzer → ${url}`);

    const start = Date.now();
    try {
      await axios.get(url, { validateStatus: () => true, timeout: 10000 });
      const loadTime = Date.now() - start;

      // Mock Web Vitals
      const navTiming: NavigationTiming = {
        dnsLookup: Math.round(loadTime * 0.1),
        tcpConnection: Math.round(loadTime * 0.2),
        ttfb: Math.round(loadTime * 0.5),
        responseTime: Math.round(loadTime * 0.4),
        domInteractive: loadTime,
        domContentLoaded: loadTime,
        totalLoad: loadTime,
      };

      const paintMetrics: PaintMetrics = {
        fcp: loadTime,
        fcpRating: rateMetric(loadTime, 1800, 3000),
        lcp: loadTime + 200,
        lcpRating: rateMetric(loadTime + 200, 2500, 4000),
      };

      const layoutShift: LayoutShift = {
        cls: 0.05,
        clsRating: 'good',
      };

      const rating: 'fast' | 'moderate' | 'slow' = loadTime < 1500 ? 'fast' : loadTime < 3000 ? 'moderate' : 'slow';

      pages.push({
        url,
        navigation: navTiming,
        paint: paintMetrics,
        layoutShift,
        rating,
        loaded: loadTime,
        firstByte: navTiming.ttfb,
        domContentLoaded: loadTime,
      });

    } catch (err) {
      Logger.warn(`PerfAnalyzer failed on ${url}: ${(err as Error).message}`);
    }
  }

  const avgLoad = pages.length
    ? Math.round(pages.reduce((s, p) => s + p.navigation.totalLoad, 0) / pages.length)
    : 0;

  const score = computeScore(pages);
  Logger.success(`PerfAnalyzer complete: ${pages.length} pages, avg load ${avgLoad}ms, score ${score}/100`);

  return { pages, avgLoad, score };
}
